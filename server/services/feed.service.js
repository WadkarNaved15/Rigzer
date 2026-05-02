// services/feed.service.js
//
// Strategy:
//   Logged-in user  → Gorse personalised IDs + pockets + like/wishlist — all parallel
//   Logged-out user → chronological AllPost + pockets — both parallel
//   Gorse timeout   → graceful fallback to chronological
//
// Cursor format:
//   "a:<objectId>"  — chronological allpost cursor
//   "p:<isoDate>"   — pocket cursor
//   "g:<offset>"    — Gorse offset cursor

import AllPost from "../models/Allposts.js";
import PocketFeedEntry from "../models/PocketFeedEntry.js";
import Like from "../models/Like.js";
import Wishlist from "../models/Wishlist.js";
import {
  getRecommendations,
  recordServed,
  fireAndForget,
} from "./gorse.client.js";

// Drop this low — if Gorse can't respond in 400ms, chronological is fine.
// A 2000ms timeout holds 200 VUs hostage for 2 full seconds each.
const GORSE_TIMEOUT_MS = 400;

// ── Gorse fetch with timeout ──────────────────────────────────────────────────

async function getGorsePostIds(userId, limit, offset) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Gorse timeout")), GORSE_TIMEOUT_MS)
  );
  return Promise.race([getRecommendations({ userId, limit, offset }), timeout]);
}

// ── Shared projection — one place to update if schema changes ─────────────────

const POST_PROJECTION = {
  _id: 1, user: 1, description: 1, type: 1,
  likesCount: 1, commentsCount: 1, createdAt: 1,
  "modelPost.price": 1,
  "modelPost.assets.originalUrl": 1,
  "modelPost.assets.optimizedUrl": 1,
  "gamePost.gameName": 1,
  "normalPost.assets": 1,
  "adModelPost.brandName": 1, "adModelPost.logoUrl": 1,
  "adModelPost.bgMode": 1, "adModelPost.bgColor": 1,
  "adModelPost.bgImageUrl": 1, "adModelPost.bgImagePosition": 1,
  "adModelPost.bgImageSize": 1, "adModelPost.overlayOpacity": 1,
  "adModelPost.asset.originalUrl": 1,
  "adModelPost.asset.optimizedUrl": 1,
  "adModelPost.asset.optimization": 1,
};

// ── Chronological fetch (guest fallback + Gorse fallback) ─────────────────────
// NOTE: No .sort() here when called from the Gorse path — Gorse order is
// preserved in JS via postMap. Sort only applies for the chronological path
// where _id ordering is the intent.

async function fetchPostsByIds(ids) {
  // Used by Gorse path: fetch exact IDs, no sort (JS preserves Gorse rank)
  return AllPost.find({
    _id: { $in: ids },
    type: { $ne: "canvas_article" },
  })
    .select(POST_PROJECTION)
    .populate("user", "username avatar")
    .lean();
}

async function fetchChronological(filter, limit) {
  // Used by guest/fallback path: sort by _id desc
  return AllPost.find({ ...filter, type: { $ne: "canvas_article" } })
    .select(POST_PROJECTION)
    .populate("user", "username avatar")
    .sort({ _id: -1 })
    .limit(limit)
    .lean();
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * @param {{ cursor?: string, limit?: number, userId?: string|null }} opts
 */
export async function getFeedPage({ cursor, limit = 10, userId } = {}) {
  // Fetch a small buffer over limit to account for the pocket merge/slice.
  // Previously this was limit*2 (20 docs for a page of 10) — wasteful over Atlas.
  const fetchLimit = limit + 3;

  // ── Parse cursor ─────────────────────────────────────────────────────────────
  let allPostFilter = {};
  let pocketFilter = {};
  let gorseOffset = 0;

  if (cursor) {
    const [type, value] = cursor.split(/:(.+)/);
    if (type === "a") {
      allPostFilter = { _id: { $lt: value } };
    } 
    // else if (type === "p") {
    //   pocketFilter = { publishedAt: { $lt: new Date(value) } };
    // } 
    else if (type === "g") {
      gorseOffset = parseInt(value, 10) || 0;
    } else {
      // Legacy cursor without prefix
      allPostFilter = { _id: { $lt: cursor } };
    }
  }

  // ── Pocket query — always needed regardless of auth, start it immediately ────
  // const pocketPromise = PocketFeedEntry.find(pocketFilter)
  //   .populate("owner", "username avatar")
  //   .sort({ publishedAt: -1 })
  //   .limit(limit)
  //   .lean();

  // ── Post fetch strategy ───────────────────────────────────────────────────────
  //
  // BEFORE (broken):
  //   1. await Gorse                          (sequential)
  //   2. await AllPost.find($in: gorseIds)    (sequential)
  //   3. await Promise.all([pocketPromise])   (pockets finally resolve here —
  //                                            but they've been waiting idle
  //                                            while steps 1+2 ran)
  //   4. await Like + Wishlist                (sequential, after everything else)
  //
  // AFTER (fixed):
  //   Gorse path:
  //     - Gorse + pockets fire in parallel
  //     - Once Gorse resolves, AllPost.find fires immediately
  //     - Like + Wishlist fire in parallel after posts are known
  //
  //   Guest/fallback path:
  //     - AllPost.find + pockets fire in parallel from the start
  //     - (No Like/Wishlist needed for guests)

  let allPosts = [];
  let usedGorse = false;

  if (userId) {
    // ── Logged-in: Gorse + pockets in parallel ──────────────────────────────
    let gorseIds = [];

    try {
      // Fire Gorse and pockets at the same time — they're independent
      const [ids] = await Promise.all([
        getGorsePostIds(userId, fetchLimit, gorseOffset),
        // pocketPromise is already running — we don't need to await it here,
        // we just want to give it a head start while Gorse resolves
      ]);
      gorseIds = ids ?? [];
    } catch (err) {
      console.warn("[Feed] Gorse unavailable, falling back to chronological:", err.message);
    }

    if (gorseIds.length > 0) {
      const safeIds = [...new Set(gorseIds)].filter((id) => id?.length === 24);

      if (safeIds.length > 0) {
        // Now fetch posts from Atlas — pockets are still running in parallel
        const docs = await fetchPostsByIds(safeIds);

        // Preserve Gorse's rank order using a Map (Atlas returns in _id order)
        const postMap = new Map(docs.map((p) => [p._id.toString(), p]));
        allPosts = safeIds.map((id) => postMap.get(id)).filter(Boolean);
        usedGorse = true;

        // Fire-and-forget impression recording — never block the response
        const servedIds = allPosts.map((p) => p._id.toString());
        fireAndForget(() => recordServed(userId, servedIds));
      }
    }

    // Gorse returned nothing or failed — fall back to chronological
    if (!usedGorse) {
      // Pockets are already in-flight; fetch posts in parallel with them
      allPosts = await fetchChronological(allPostFilter, fetchLimit);
    }
  } else {
    // ── Guest: chronological posts + pockets fully in parallel ──────────────
    // pocketPromise is already running from line ~60.
    // Fire the Atlas query right now so both run concurrently.
    [allPosts] = await Promise.all([
      fetchChronological(allPostFilter, fetchLimit),
      // pocketPromise resolves on its own — collected below
    ]);
  }

  // ── Collect pockets (already in-flight since the top of the function) ────────
  // const pocketEntries = await pocketPromise;

  // ── Trim model assets to first only ──────────────────────────────────────────
  for (const post of allPosts) {
    if (post.modelPost?.assets?.length > 1) {
      post.modelPost.assets = [post.modelPost.assets[0]];
    }
  }

  // ── Normalise to common shape ─────────────────────────────────────────────────
  const normalisedAllPosts = allPosts.map((p, idx) => ({
    ...p,
    _sortKey: usedGorse
      ? Date.now() - idx * 1000          // preserve Gorse rank order
      : p._id.getTimestamp().getTime(),  // chronological order
    _cursorType: usedGorse ? "g" : "a",
    _cursorVal: usedGorse
      ? String(gorseOffset + fetchLimit)
      : p._id.toString(),
  }));

  // const normalisedPockets = pocketEntries.map((e) => ({
  //   _id: e._id,
  //   createdAt: e.createdAt,
  //   updatedAt: e.updatedAt,
  //   publishedAt: e.publishedAt,
  //   type: "pocket_update",
  //   user: e.owner,
  //   likesCount: e.likesCount,
  //   commentsCount: e.commentsCount,
  //   isLiked: false,
  //   brandName: e.brandName,
  //   tagline: e.tagline,
  //   compiledBundleUrl: e.compiledBundleUrl,
  //   _pocketEntryId: e._id,
  //   _sortKey: new Date(e.publishedAt).getTime(),
  //   _cursorType: "p",
  //   _cursorVal: e.publishedAt.toISOString(),
  // }));

  // ── Merge, sort, slice ────────────────────────────────────────────────────────
  const merged = [...normalisedAllPosts]
    .sort((a, b) => b._sortKey - a._sortKey)
    .slice(0, limit);

  if (merged.length === 0) {
    return { posts: [], nextCursor: null };
  }

  // ── Enrich isLiked / isWishlisted (logged-in only) ───────────────────────────
  // Run Like + Wishlist in parallel — two Atlas round-trips become one wait.
  // This block previously ran after everything else; now it's the last async
  // operation and both queries fire simultaneously.
  if (userId) {
    const allPostIds = merged
      .filter((p) => p.type !== "pocket_update")
      .map((p) => p._id);

    if (allPostIds.length) {
      const [userLikes, userWishlists] = await Promise.all([
        Like.find({ user: userId, post: { $in: allPostIds } })
          .select("post")
          .lean(),
        Wishlist.find({ user: userId, post: { $in: allPostIds } })
          .select("post")
          .lean(),
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

  // ── Build nextCursor ──────────────────────────────────────────────────────────
  const last = merged[merged.length - 1];
  const nextCursor = `${last._cursorType}:${last._cursorVal}`;

  const posts = merged.map(({ _sortKey, _cursorType, _cursorVal, ...rest }) => rest);

  return { posts, nextCursor };
}