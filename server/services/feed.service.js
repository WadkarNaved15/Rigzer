// services/feed.service.js
//
// Strategy:
//   Logged-in user  → Gorse personalised IDs + pockets + like/wishlist — all parallel
//   Logged-out user → chronological AllPost + pockets — both parallel
//   Gorse timeout   → graceful fallback to chronological
//
// Cursor format:
//   "a:<objectId>"       — chronological AllPost cursor
//   "g:<offset>:<pos>"    — Gorse snapshot cursor
//


import crypto from "node:crypto";
import pino from "pino"; // npm i pino
import AllPost from "../models/Allposts.js";
import Like from "../models/Like.js";
import Wishlist from "../models/Wishlist.js";
import User from "../models/User.js";
import {
  getRecommendations,
} from "./gorse.client.js";
import { enrichDemoConsumed } from "../utils/enrichDemoConsumed.js";
import { enrichSessionRequests } from "../utils/enrichSessionRequests.js";
import redisClient from "../config/redis.js";

// ── Logger ──────────────────────────────────────────────────────────────────
// LOG_LEVEL=debug locally, LOG_LEVEL=info (or warn) in prod. Verbose per-request
// dumps go through logger.debug so they're OFF by default in production and can
// be flipped on live via env var without a redeploy.
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty" }
      : undefined,
});

// ── Tunables (env-overridable so you can adjust live during an incident) ────
const GORSE_TIMEOUT_MS = Number(process.env.GORSE_TIMEOUT_MS) || 600;
const GORSE_POOL_SIZE = Number(process.env.GORSE_POOL_SIZE) || 30;
const FEED_SNAPSHOT_TTL_SECONDS =
  Number(process.env.FEED_SNAPSHOT_TTL_SECONDS) || 15 * 60;
const FEED_SNAPSHOT_PREFIX = "feed:snapshot";
const FEED_LOCK_TTL_MS = 3000; // max time a request may hold the per-user lock
const MAX_LIMIT = 30;
const DEFAULT_LIMIT = 10;

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

function getFeedSnapshotKey(userId) {
  return `${FEED_SNAPSHOT_PREFIX}:${userId}`;
}

function getFeedLockKey(userId) {
  return `feed:lock:${userId}`;
}

// ── FIX #3: input validation helpers ─────────────────────────────────────────

function clampLimit(limit) {
  const n = Number.parseInt(limit, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function isValidObjectId(value) {
  return typeof value === "string" && OBJECT_ID_RE.test(value);
}

// ── FIX #1: per-user distributed lock around snapshot read-modify-write ─────
//
// Without this, two concurrent requests for the same user can both read
// position N, both compute position N+limit, and both write — one page of
// posts gets served twice, another gets silently skipped. This wraps the
// read-modify-write in a short-lived Redis lock so only one request at a
// time can touch a given user's snapshot.

class FeedLockBusyError extends Error {
  constructor() {
    super("FEED_LOCK_BUSY");
    this.name = "FeedLockBusyError";
  }
}

async function withUserFeedLock(userId, fn) {
  const lockKey = getFeedLockKey(userId);
  const lockValue = crypto.randomUUID();

  const acquired = await redisClient.set(lockKey, lockValue, {
    NX: true,
    PX: FEED_LOCK_TTL_MS,
  });

  if (!acquired) {
    // Another request for this user is mid-consume right now. Rather than
    // silently reading a stale snapshot, surface this so the caller can
    // fall back safely (see getFeedPage catch block).
    throw new FeedLockBusyError();
  }

  try {
    return await fn();
  } finally {
    // Only release the lock if we still own it — guards against releasing
    // someone else's lock if ours expired and was re-acquired in the meantime.
    const releaseScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    try {
      await redisClient.eval(releaseScript, {
        keys: [lockKey],
        arguments: [lockValue],
      });
    } catch (err) {
      logger.warn({ err, userId }, "[FEED LOCK] release failed (will self-expire via TTL)");
    }
  }
}

// ── FIX #8: snapshot save no longer throws ───────────────────────────────────

async function saveFeedSnapshot({ userId, posts, gorseOffset, position = 0 }) {
  if (!userId || !posts?.length) return;

  const snapshotKey = getFeedSnapshotKey(userId);
  const snapshot = {
    version: 1,
    ids: posts.map((post) => post._id.toString()),
    // Allow pre-advancing position so a snapshot can be saved *already past*
    // the page we're serving right now — avoids a second read-modify-write
    // round trip immediately after this write (see PERF FIX #2 below).
    position,
    gorseOffset,
    createdAt: Date.now(),
  };

  try {
    await redisClient.setEx(
      snapshotKey,
      FEED_SNAPSHOT_TTL_SECONDS,
      JSON.stringify(snapshot)
    );
    logger.debug(
      { userId, postCount: snapshot.ids.length, gorseOffset },
      "[FEED SNAPSHOT] created"
    );
  } catch (err) {
    // A failed cache write should degrade gracefully, not fail the request.
    // Worst case: the next request just re-fetches a fresh pool from Gorse.
    logger.warn({ err, userId }, "[FEED SNAPSHOT] write failed, continuing without cache");
  }
}

async function getFeedSnapshot(userId) {
  if (!userId) return null;

  const snapshotKey = getFeedSnapshotKey(userId);

  try {
    const raw = await redisClient.get(snapshotKey);
    if (!raw) return null;

    const snapshot = JSON.parse(raw);
    if (
      !snapshot ||
      !Array.isArray(snapshot.ids) ||
      typeof snapshot.position !== "number"
    ) {
      logger.warn({ snapshotKey }, "[FEED SNAPSHOT] invalid snapshot, discarding");
      await redisClient.del(snapshotKey).catch(() => { });
      return null;
    }

    return snapshot;
  } catch (err) {
    logger.warn({ err, snapshotKey }, "[FEED SNAPSHOT] read failed");
    return null;
  }
}

async function consumeFeedSnapshotUnlocked({
  userId,
  limit,
  isAdmin,
  canViewTestUploads,
  expectedOffset = null,
  expectedPosition = null,
}) {
  const snapshot = await getFeedSnapshot(userId);
  if (!snapshot) return null;

  if (expectedOffset !== null && snapshot.gorseOffset !== expectedOffset) {
    logger.debug({ userId, expectedOffset, actualOffset: snapshot.gorseOffset }, "[FEED SNAPSHOT] offset mismatch");
    return {
      stale: true,
      posts: [],
      gorseOffset: snapshot.gorseOffset,
      position: snapshot.position,
      exhausted: false,
    };
  }

  if (expectedPosition !== null && snapshot.position !== expectedPosition) {
    logger.debug({ userId, expectedPosition, actualPosition: snapshot.position }, "[FEED SNAPSHOT] position mismatch");
    return {
      stale: true,
      posts: [],
      gorseOffset: snapshot.gorseOffset,
      position: snapshot.position,
      exhausted: false,
    };
  }

  const remainingIds = snapshot.ids.slice(snapshot.position);

  if (remainingIds.length === 0) {
    await redisClient.del(getFeedSnapshotKey(userId)).catch(() => { });
    logger.debug({ userId }, "[FEED SNAPSHOT] exhausted");
    return {
      posts: [],
      gorseOffset: snapshot.gorseOffset,
      position: snapshot.position,
      exhausted: true,
    };
  }

  const previousPosition = snapshot.position;
  const pageIds = remainingIds.slice(0, limit);

  const docs = await fetchPostsByIds(pageIds, isAdmin, canViewTestUploads);
  const postMap = new Map(docs.map((post) => [post._id.toString(), post]));
  const posts = pageIds.map((id) => postMap.get(id)).filter(Boolean);

  // Advance by IDs consumed from the Gorse sequence, not by Mongo hits —
  // a post deleted from Mongo is still "consumed" from the ranking.
  const newPosition = previousPosition + pageIds.length;
  const exhausted = newPosition >= snapshot.ids.length;

  if (exhausted) {
    await redisClient.del(getFeedSnapshotKey(userId)).catch(() => { });
  } else {
    const updatedSnapshot = { ...snapshot, position: newPosition };
    await redisClient.setEx(
      getFeedSnapshotKey(userId),
      FEED_SNAPSHOT_TTL_SECONDS,
      JSON.stringify(updatedSnapshot)
    );
  }

  logger.debug(
    {
      userId,
      requestedLimit: limit,
      returnedCount: posts.length,
      previousPosition,
      newPosition,
      exhausted,
    },
    "[FEED SNAPSHOT] consumed"
  );

  return { posts, gorseOffset: snapshot.gorseOffset, position: newPosition, exhausted };
}

// Public wrapper — always goes through the per-user lock.
async function consumeFeedSnapshot(args) {
  return withUserFeedLock(args.userId, () => consumeFeedSnapshotUnlocked(args));
}

// ── FIX #6: Gorse fetch clears its timeout timer ─────────────────────────────

async function getGorsePostIds(userId, limit, offset) {
  let timer;

  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      resolve({
        ok: false,
        ids: [],
        error: new Error("Gorse timeout"),
      });
    }, GORSE_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      getRecommendations({
        userId,
        limit,
        offset,
      }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// ── FIX #7: lightweight circuit breaker for Gorse ────────────────────────────
// In-memory per-process. On a multi-instance deployment each instance trips
// independently — good enough to stop cascading latency during a Gorse
// incident, but if you want it shared across instances, back this with a
// Redis counter instead (or swap in `opossum`).

const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 30_000;
const gorseCircuit = { consecutiveFailures: 0, openUntil: 0 };

function isGorseCircuitOpen() {
  return Date.now() < gorseCircuit.openUntil;
}

function recordGorseSuccess() {
  gorseCircuit.consecutiveFailures = 0;
  gorseCircuit.openUntil = 0;
}

function recordGorseFailure() {
  gorseCircuit.consecutiveFailures += 1;
  if (gorseCircuit.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
    gorseCircuit.openUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    logger.warn(
      { cooldownMs: CIRCUIT_COOLDOWN_MS },
      "[Gorse] circuit opened — skipping Gorse calls temporarily"
    );
  }
}

// ── Shared projection ─────────────────────────────────────────────────────

const POST_PROJECTION = {
  _id: 1,
  user: 1,
  description: 1,
  type: 1,
  viewsCount: 1,
  uniqueViewsCount: 1,
  likesCount: 1,
  commentsCount: 1,
  createdAt: 1,
  mentions: 1,
  hasInteractMention: 1,
  "modelPost.price": 1,
  "modelPost.assets.originalUrl": 1,
  "modelPost.assets.optimizedUrl": 1,
  "modelPost.assets.fieldOfView": 1,
  "modelPost.assets.background.type": 1,
  "modelPost.assets.background.color": 1,
  "modelPost.assets.background.color1": 1,
  "modelPost.assets.background.color2": 1,
  "gamePost.gameName": 1,
  "gamePost.price": 1,
  "gamePost.version": 1,
  "gamePost.videoDemo": 1,
  "gamePost.maxSessionDurationMinutes": 1,
  "gamePost.creditBudget.usedCredits": 1,
  "gamePost.creditBudget.remainingCredits": 1,
  "gamePost.gameMetrics.totalSessions": 1,
  "gamePost.gameMetrics.uniquePlayers": 1,
  "gamePost.gameMetrics.totalSessionTimeMs": 1,
  "gamePost.gameMetrics.sessionRequests": 1,
  "gamePost.isTestUpload": 1,
  "normalPost.assets": 1,
  "adModelPost.brandName": 1,
  "adModelPost.logoUrl": 1,
  "adModelPost.bgMode": 1,
  "adModelPost.bgColor": 1,
  "adModelPost.bgImageUrl": 1,
  "adModelPost.bgImagePosition": 1,
  "adModelPost.bgImageSize": 1,
  "adModelPost.overlayOpacity": 1,
  "adModelPost.ctaText": 1,
  "adModelPost.ctaLink": 1,
  "adModelPost.style.ctaColor": 1,
  "adModelPost.asset.originalUrl": 1,
  "adModelPost.asset.optimizedUrl": 1,
  "adModelPost.asset.optimization": 1,
  "adModelPost.asset.fieldOfView": 1,
};

async function fetchPostsByIds(ids, isAdmin = false, canViewTestUploads = false) {
  const filter = {
    _id: { $in: ids },
    type: isAdmin ? { $ne: "canvas_article" } : { $nin: ["canvas_article"] },
  };

  if (!canViewTestUploads) {
    filter["gamePost.isTestUpload"] = { $ne: true };
  }

  return AllPost.find(filter)
    .select(POST_PROJECTION)
    .populate("user", "username avatar displayName isRigzer")
    .populate("mentions.user", "username displayName avatar")
    .lean();
}

async function getValidatedGorsePool({ userId, poolSize, offset, permsPromise }) {
  const gorseStartTime = Date.now();
  
  const [gorseResult, { isAdmin, canViewTestUploads }] =
    await Promise.all([
      getGorsePostIds(userId, poolSize, offset),
      permsPromise,
    ]);

  if (!gorseResult.ok) {
    throw gorseResult.error || new Error("Gorse unavailable");
  }

  const gorseIds = gorseResult.ids;

  const safeIds = [...new Set(gorseIds ?? [])].filter(
    (id) => typeof id === "string" && id.length === 24
  );

  logger.debug(
    {
      userId,
      durationMs: Date.now() - gorseStartTime,
      requestedPoolSize: poolSize,
      returnedFromGorse: gorseIds?.length ?? 0,
      safeIdsCount: safeIds.length,
    },
    "[FEED POOL] gorse candidates"
  );

  if (safeIds.length === 0) {
    return { candidateIds: [], posts: [], gorseReturnedCount: 0, gorseConsumedCount: 0 };
  }

  const docs = await fetchPostsByIds(safeIds, isAdmin, canViewTestUploads);
  const postMap = new Map(docs.map((post) => [post._id.toString(), post]));

  // Reconstruct Gorse's exact ranking order — Mongo's $in gives no order guarantee.
  const validPosts = safeIds.map((id) => postMap.get(id)).filter(Boolean);
  const validIds = validPosts.map((post) => post._id.toString());

  return {
    candidateIds: validIds,
    posts: validPosts,
    gorseReturnedCount: safeIds.length,
    gorseConsumedCount: gorseIds?.length ?? 0,
  };
}

async function fetchChronological(filter, limit, isAdmin = false, canViewTestUploads = false) {
  if (!canViewTestUploads) {
    filter["gamePost.isTestUpload"] = { $ne: true };
  }

  const query = { ...filter };
  query.type = !isAdmin ? { $nin: ["canvas_article"] } : { $ne: "canvas_article" };

  return AllPost.find(query)
    .select(POST_PROJECTION)
    .populate("user", "username avatar displayName isRigzer")
    .populate("mentions.user", "username displayName avatar")
    .sort({ _id: -1 })
    .limit(limit)
    .lean();
}

// ── FIX #8b: cache the user role/perms lookup so we're not hitting Mongo on
// every single feed request for data that rarely changes ───────────────────

async function getUserFeedPerms(userId) {
  const cacheKey = `feed:perms:${userId}`;

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    logger.warn({ err, userId }, "[FEED PERMS] cache read failed");
  }

  const user = await User.findById(userId).select("role isGameTester").lean();
  const perms = {
    isAdmin: user?.role === "admin",
    canViewTestUploads: user?.role === "admin" || user?.isGameTester === true,
  };

  redisClient
    .setEx(cacheKey, 300, JSON.stringify(perms)) // 5 min TTL — short enough that a role change propagates quickly
    .catch((err) => logger.warn({ err, userId }, "[FEED PERMS] cache write failed"));

  return perms;
}

// ── Main export ───────────────────────────────────────────────────────────

/**
 * @param {{ cursor?: string, limit?: number, userId?: string|null }} opts
 */
export async function getFeedPage({ cursor, limit = DEFAULT_LIMIT, userId } = {}) {
  const fetchLimit = clampLimit(limit);

  try {
    return await getFeedPageInner({ cursor, fetchLimit, userId });
  } catch (err) {
    if (err instanceof FeedLockBusyError) {
      // Another request for this user is already consuming the snapshot.
      // Tell the client this is transient and safe to retry rather than
      // silently double- or under-serving posts.
      logger.debug({ userId }, "[FEED SERVICE] lock busy, asking client to retry");
      return { posts: [], nextCursor: cursor ?? null, retry: true };
    }

    // FIX #2: anything else unexpected — log it and degrade to a plain
    // chronological page instead of 500ing the request.
    logger.error({ err, userId, cursor }, "[FEED SERVICE] unexpected error, falling back to chronological");

    try {
      const fallbackCursor =
        cursor && isValidObjectId(cursor.split(/:(.+)/)[1]) ? cursor.split(/:(.+)/)[1] : null;
      const filter = fallbackCursor ? { _id: { $lt: fallbackCursor } } : {};
      const posts = await fetchChronological(filter, fetchLimit, false, false);
      const nextCursor = posts.length ? `a:${posts[posts.length - 1]._id.toString()}` : null;
      return { posts, nextCursor };
    } catch (fallbackErr) {
      logger.error({ err: fallbackErr, userId }, "[FEED SERVICE] fallback also failed");
      return { posts: [], nextCursor: null, error: true };
    }
  }
}

async function getFeedPageInner({ cursor, fetchLimit, userId }) {
  // PERF FIX #1: kick perms off immediately but don't block on it — it's only
  // actually needed once we're about to hit Mongo, and by then it'll usually
  // have resolved for free alongside the Gorse call or the snapshot check.
  const permsPromise = userId
    ? getUserFeedPerms(userId)
    : Promise.resolve({ isAdmin: false, canViewTestUploads: false });

  let merged = [];
  let nextCursor = null;
  let allPostFilter = {};
  let gorseOffset = 0;
  let snapshotPosition = null;

  // ── FIX #3: validate cursor before trusting it ──────────────────────────
  if (cursor) {
    const [type, value] = cursor.split(/:(.+)/);

    if (type === "a") {
      if (!isValidObjectId(value)) {
        logger.warn({ cursor }, "[FEED SERVICE] invalid chronological cursor, treating as page 1");
      } else {
        allPostFilter = { _id: { $lt: value } };
      }
    } else if (type === "g") {
      const parts = value.split(":");
      const parsedOffset = Number.parseInt(parts[0], 10);
      const parsedPosition = parts.length > 1 ? Number.parseInt(parts[1], 10) : null;

      if (!Number.isFinite(parsedOffset) || (parsedPosition !== null && !Number.isFinite(parsedPosition))) {
        logger.warn({ cursor }, "[FEED SERVICE] invalid gorse cursor, treating as page 1");
      } else {
        gorseOffset = parsedOffset;
        snapshotPosition = parsedPosition;
      }
    } else if (isValidObjectId(cursor)) {
      allPostFilter = { _id: { $lt: cursor } };
    } else {
      logger.warn({ cursor }, "[FEED SERVICE] unrecognized cursor, treating as page 1");
    }
  }

  // ── Logged-in user ────────────────────────────────────────────────────
  if (userId) {
    if (cursor?.startsWith("a:")) {
      const { isAdmin, canViewTestUploads } = await permsPromise;
      merged = await fetchChronological(allPostFilter, fetchLimit, isAdmin, canViewTestUploads);
      if (merged.length > 0) {
        nextCursor = `a:${merged[merged.length - 1]._id.toString()}`;
      }
    } else {
      // PERF FIX #2: on a fresh page-1 request we just deleted the snapshot
      // ourselves, so we already know for a fact it's gone. The old code
      // still called consumeFeedSnapshot here anyway — a guaranteed-miss
      // lock-acquire + Redis-get + lock-release for nothing. Skip straight
      // to Gorse instead.
      const isFreshRequest = !cursor;

      if (isFreshRequest) {
        await redisClient.del(getFeedSnapshotKey(userId)).catch(() => { });
      }

      let snapshotPage = null;
      if (!isFreshRequest) {
        const { isAdmin, canViewTestUploads } = await permsPromise;
        snapshotPage = await consumeFeedSnapshot({
          userId,
          limit: fetchLimit,
          isAdmin,
          canViewTestUploads,
          expectedOffset: cursor?.startsWith("g:") ? gorseOffset : null,
          expectedPosition: cursor?.startsWith("g:") ? snapshotPosition : null,
        });
      }

      if (snapshotPage) {
        merged = snapshotPage.posts;
        nextCursor = `g:${snapshotPage.gorseOffset}:${snapshotPage.position}`;
      } else {
        let allPosts = [];
        let gorseConsumedCount = 0;
        let gorseFailed = false;

        if (isGorseCircuitOpen()) {
          gorseFailed = true;
          logger.debug({ userId }, "[FEED SERVICE] gorse circuit open, skipping straight to chronological");
        } else {
          try {
            const pool = await getValidatedGorsePool({
              userId,
              poolSize: GORSE_POOL_SIZE,
              offset: gorseOffset,
              permsPromise,
            });

            allPosts = pool.posts;
            gorseConsumedCount = pool.gorseConsumedCount;
            recordGorseSuccess();
          } catch (err) {
            gorseFailed = true;
            recordGorseFailure();
            logger.warn({ err: err.message, userId }, "[FEED SERVICE] gorse unavailable, falling back");
          }
        }

        if (gorseFailed) {
          const { isAdmin, canViewTestUploads } = await permsPromise;
          merged = await fetchChronological(allPostFilter, fetchLimit, isAdmin, canViewTestUploads);
          if (merged.length > 0) {
            nextCursor = `a:${merged[merged.length - 1]._id.toString()}`;
          }
        } else if (allPosts.length === 0) {
          logger.debug({ userId }, "[FEED SERVICE] gorse exhausted, no more posts");
          return { posts: [], nextCursor: null };
        } else {
          // PERF FIX #2 (cont.): we already have the full ranked pool of posts
          // in memory (allPosts, fetched once in getValidatedGorsePool). Slice
          // the first page straight out of it instead of writing the snapshot
          // and then immediately reading + re-fetching-from-Mongo the same
          // page back through consumeFeedSnapshot. Saves 3 Redis round trips
          // (lock acquire, get, lock release) and a duplicate Mongo query on
          // every cold load.
          const gorseNextOffset = gorseOffset + gorseConsumedCount;
          const pageLimit = Math.min(fetchLimit, allPosts.length);
          const fullyServedFromThisPool = pageLimit >= allPosts.length;

          merged = allPosts.slice(0, pageLimit);

          if (fullyServedFromThisPool) {
            // Nothing left over worth caching — next request just pulls a
            // fresh pool starting at gorseNextOffset.
            nextCursor = `g:${gorseNextOffset}:0`;
          } else {
            // Cache the remainder, pre-advanced past what we're serving now,
            // so the *next* request reads it directly with no extra work.
            await saveFeedSnapshot({
              userId,
              posts: allPosts,
              gorseOffset: gorseNextOffset,
              position: pageLimit,
            });
            nextCursor = `g:${gorseNextOffset}:${pageLimit}`;
          }
        }
      }
    }
  } else {
    // ── Guest user → chronological ──────────────────────────────────────
    // Guests are never admins/testers, so there's no perms lookup to await here.
    merged = await fetchChronological(allPostFilter, fetchLimit, false, false);
    if (merged.length > 0) {
      nextCursor = `a:${merged[merged.length - 1]._id.toString()}`;
    }
  }

  if (merged.length === 0) {
    return { posts: [], nextCursor: null };
  }

  for (const post of merged) {
    if (post.modelPost?.assets?.length > 1) {
      post.modelPost.assets = [post.modelPost.assets[0]];
    }
  }

  if (userId) {
    const allPostIds = merged.filter((p) => p.type !== "pocket_update").map((p) => p._id);

    if (allPostIds.length) {
      const [userLikes, userWishlists] = await Promise.all([
        Like.find({ user: userId, post: { $in: allPostIds } }).select("post").lean(),
        Wishlist.find({ user: userId, post: { $in: allPostIds } }).select("post").lean(),
      ]);

      const likedSet = new Set(userLikes.map((l) => l.post.toString()));
      const wishlistSet = new Set(userWishlists.map((w) => w.post.toString()));

      for (const p of merged) {
        if (p.type !== "pocket_update") {
          p.isLiked = likedSet.has(p._id.toString());
          p.isWishlisted = wishlistSet.has(p._id.toString());
        }
      }
    }
  }

  await Promise.all([enrichDemoConsumed(merged, userId), enrichSessionRequests(merged, userId)]);

  const posts = merged.map(({ _sortKey, _cursorType, _cursorVal, ...rest }) => rest);

  logger.debug(
    { incomingCursor: cursor ?? null, returnedCount: posts.length, nextCursor },
    "[FEED SERVICE] final page"
  );

  return { posts, nextCursor };
}