// services/feed.service.js
// Cursor-based feed — now Gorse-powered for logged-in users.
//
// Strategy:
//   Logged-in user  → ask Gorse for personalised post IDs, fetch from MongoDB,
//                      record impressions back to Gorse, merge with pockets.
//   Logged-out user → fall back to the original chronological MongoDB query
//                      (unchanged behaviour).
//   Gorse timeout   → graceful fallback to chronological if Gorse is slow/down.
//
// Cursor format (unchanged):
//   "a:<objectId>"  — allpost cursor
//   "p:<isoDate>"   — pocket cursor

import AllPost from "../models/Allposts.js";
import PocketFeedEntry from "../models/PocketFeedEntry.js";
import Like from "../models/Like.js";
import Wishlist from "../models/Wishlist.js";
import {
  getRecommendations,
  getPopular,
  recordServed,
  fireAndForget,
} from "./gorse.client.js";

// How long to wait for Gorse before falling back to chronological (ms)
const GORSE_TIMEOUT_MS = 2000;

// ── Gorse-powered post fetch ──────────────────────────────────────────────────

async function getGorsePostIds(userId, limit, offset) {
  // Race Gorse against a timeout so a slow Gorse never stalls your feed
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Gorse timeout")), GORSE_TIMEOUT_MS)
  );
  return Promise.race([
    getRecommendations({ userId, limit, offset }),
    timeoutPromise,
  ]);
}

// ── Chronological fallback (your original logic) ──────────────────────────────

async function getChronologicalPosts(filter, limit) {
  return AllPost.find({ ...filter, type: { $ne: "canvas_article" } })
    .select({
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
    })
    .populate("user", "username avatar")
    .sort({ _id: -1 })
    .limit(limit)
    .lean();
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * @param {{ cursor?: string, limit?: number, userId?: string }} opts
 */
export async function getFeedPage({ cursor, limit = 10, userId } = {}) {
  const fetchLimit = limit * 2;

  // ── Parse cursor ────────────────────────────────────────────────────────────
  let allPostFilter = {};
  let pocketFilter = {};
  let gorseOffset = 0;

  if (cursor) {
    const [type, value] = cursor.split(/:(.+)/);
    if (type === "a") {
      allPostFilter = { _id: { $lt: value } };
    } else if (type === "p") {
      pocketFilter = { publishedAt: { $lt: new Date(value) } };
    } else if (type === "g") {
      // Gorse cursor: "g:<offset>"
      gorseOffset = parseInt(value, 10) || 0;
      allPostFilter = {}; // Gorse handles pagination, not _id
    } else {
      allPostFilter = { _id: { $lt: cursor } };
    }
  }

  // ── Fetch pockets (always, same as before) ──────────────────────────────────
  const pocketPromise = PocketFeedEntry.find(pocketFilter)
    .populate("owner", "username avatar")
    .sort({ publishedAt: -1 })
    .limit(limit)
    .lean();

  // ── Fetch posts: Gorse (logged-in) or chronological (fallback/logged-out) ───
  let allPosts = [];
  let usedGorse = false;

  if (userId) {
    try {
      const gorseIds = await getGorsePostIds(userId, fetchLimit, gorseOffset);

      if (gorseIds.length > 0) {
        // Fetch full post docs for the Gorse-ordered IDs
        const uniqueIds = [...new Set(gorseIds)];
        const postMap = new Map();
        const safeIds = uniqueIds.filter((id) => id && id.length === 24);

        const docs = await getChronologicalPosts(
          { _id: { $in: safeIds } },
          fetchLimit
        );
        docs.forEach((p) => postMap.set(p._id.toString(), p));

        // Preserve Gorse's order (it already ranked them for this user)
        allPosts = uniqueIds
          .map((id) => postMap.get(id))
          .filter(Boolean);

        usedGorse = true;
        const servedIds = allPosts.map(p => p._id.toString());
        // Record impressions so Gorse knows what was shown (fire-and-forget)
        fireAndForget(() =>
          recordServed(userId, servedIds)
        );
      }
    } catch (err) {
      console.warn("[Feed] Gorse unavailable, falling back to chronological:", err.message);
    }
  }

  // Fallback: original chronological query
  if (!usedGorse) {
    allPosts = await getChronologicalPosts(allPostFilter, fetchLimit);
  }

  const [pocketEntries] = await Promise.all([pocketPromise]);

  // ── Trim model assets to first only (unchanged) ────────────────────────────
  const trimmedPosts = allPosts.map((post) => {
    if (post.modelPost?.assets?.length) {
      post.modelPost.assets = [post.modelPost.assets[0]];
    }
    return post;
  });

  // ── Normalise to common shape (unchanged) ──────────────────────────────────
  const normalisedAllPosts = trimmedPosts.map((p, idx) => ({
    ...p,
    // When using Gorse, sortKey = rank order (higher = earlier in feed)
    // When using chronological, sortKey = createdAt timestamp (original behaviour)
    _sortKey: usedGorse
      ? Date.now() - idx * 1000   // preserve Gorse rank order
      : p._id.getTimestamp().getTime(),
    _cursorType: usedGorse ? "g" : "a",
    _cursorVal: usedGorse
      ? String(gorseOffset + fetchLimit)   // next page offset for Gorse
      : p._id.toString(),
  }));

  const normalisedPockets = pocketEntries.map((e) => ({
    _id: e._id,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    publishedAt: e.publishedAt,
    type: "pocket_update",
    user: e.owner,
    likesCount: e.likesCount,
    commentsCount: e.commentsCount,
    isLiked: false,
    brandName: e.brandName,
    tagline: e.tagline,
    compiledBundleUrl: e.compiledBundleUrl,
    _pocketEntryId: e._id,
    _sortKey: new Date(e.publishedAt).getTime(),
    _cursorType: "p",
    _cursorVal: e.publishedAt.toISOString(),
  }));

  // ── Merge, sort, slice ─────────────────────────────────────────────────────
  const merged = [...normalisedAllPosts, ...normalisedPockets]
    .sort((a, b) => b._sortKey - a._sortKey)
    .slice(0, limit);

  if (merged.length === 0) {
    return { posts: [], nextCursor: null };
  }

  // ── Enrich isLiked / isWishlisted ─────────────────────────────────────────
  if (userId) {
    const allPostIds = merged
      .filter((p) => p.type !== "pocket_update")
      .map((p) => p._id);

    if (allPostIds.length) {
      const [userLikes, userWishlists] = await Promise.all([
        Like.find({ user: userId, post: { $in: allPostIds } }).select("post").lean(),
        Wishlist.find({ user: userId, post: { $in: allPostIds } }).select("post").lean(),
      ]);

      const likedSet = new Set(userLikes.map((l) => l.post.toString()));
      const wishlistSet = new Set(userWishlists.map((w) => w.post.toString()));

      merged.forEach((p) => {
        if (p.type !== "pocket_update") {
          p.isLiked = likedSet.has(p._id.toString());
          p.isWishlisted = wishlistSet.has(p._id.toString());
        }
      });
    }
  }

  // ── Build nextCursor ───────────────────────────────────────────────────────
  const last = merged[merged.length - 1];
  const nextCursor = `${last._cursorType}:${last._cursorVal}`;

  const posts = merged.map(({ _sortKey, _cursorType, _cursorVal, ...rest }) => rest);

  return { posts, nextCursor };
}