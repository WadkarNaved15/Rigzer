// services/feed.service.js
// Cursor-based feed merge — AllPost rows + PocketFeedEntry rows.
//
// Ordering:
//   AllPost        — sorted by _id desc (ObjectId ≡ createdAt, existing behaviour)
//   PocketFeedEntry — sorted by publishedAt desc (reset on every approval so
//                     re-approved pockets surface as fresh content)
//
// The two collections use different sort keys so we normalise both to a
// plain `sortKey` (millisecond timestamp) for the merge step, then derive
// the nextCursor from whichever collection's natural key applies.

import AllPost from "../models/Allposts.js";
import PocketFeedEntry from "../models/PocketFeedEntry.js";
import Like from "../models/Like.js";

/**
 * @param {{ cursor?: string, limit?: number, userId?: string }} opts
 * cursor format:  "<type>:<value>"
 *   allpost:      "a:<objectId>"   — filters _id < objectId
 *   pocket:       "p:<isoDate>"    — filters publishedAt < date
 *   initial:      undefined / ""
 *
 * We encode the cursor type so the feed can page independently
 * across the two collections without conflating their sort keys.
 */
export async function getFeedPage({ cursor, limit = 10, userId } = {}) {
  const fetchLimit = limit * 2;

  // ── Parse cursor ──────────────────────────────────────────────────────────
  let allPostFilter = {};
  let pocketFilter = {};

  if (cursor) {
    const [type, value] = cursor.split(/:(.+)/); // split on first colon only
    if (type === "a") {
      allPostFilter = { _id: { $lt: value } };
    } else if (type === "p") {
      pocketFilter = { publishedAt: { $lt: new Date(value) } };
    } else {
      // Legacy plain-objectId cursor from before this change — treat as allpost
      allPostFilter = { _id: { $lt: cursor } };
    }
  }

  // ── Fetch both collections in parallel ────────────────────────────────────
  const [allPosts, pocketEntries] = await Promise.all([
    AllPost.find({
    ...allPostFilter,
    type: { $ne: "canvas_article" },
  })
    .select({
      _id: 1,
      user: 1,
      description: 1,
      type: 1,
      likesCount: 1,
      commentsCount: 1,
      createdAt: 1,

      // model post
      "modelPost.price": 1,
      "modelPost.assets.originalUrl": 1,
      "modelPost.assets.optimizedUrl": 1,

      // game post
      "gamePost.gameName": 1,

      // normal post
      "normalPost.assets": 1,

      // ad model post
      "adModelPost.brandName": 1,
      "adModelPost.logoUrl": 1,
      "adModelPost.bgMode": 1,
      "adModelPost.bgColor": 1,
      "adModelPost.bgImageUrl": 1,
      "adModelPost.bgImagePosition": 1,
      "adModelPost.bgImageSize": 1,
      "adModelPost.overlayOpacity": 1,

       // asset (only required fields)
      "adModelPost.asset.originalUrl": 1,
      "adModelPost.asset.optimizedUrl": 1,
      "adModelPost.asset.optimization": 1,
    })
    .populate("user", "username avatar")
    .sort({ _id: -1 })
    .limit(fetchLimit)
    .lean(),

  PocketFeedEntry.find(pocketFilter)
    .populate("owner", "username avatar")
    .sort({ publishedAt: -1 })
    .limit(limit)
    .lean(),
  ]);
const trimmedPosts = allPosts.map((post) => {
  if (post.modelPost?.assets?.length) {
    post.modelPost.assets = [post.modelPost.assets[0]];
  }
  return post;
});
  // ── Normalise to a common shape ───────────────────────────────────────────
  const normalisedAllPosts = trimmedPosts.map((p) => ({
    ...p,
    _sortKey: p._id.getTimestamp().getTime(), // ms from ObjectId
    _cursorType: "a",
    _cursorVal: p._id.toString(),
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
    _sortKey: new Date(e.publishedAt).getTime(), // ms from publishedAt
    _cursorType: "p",
    _cursorVal: e.publishedAt.toISOString(),
  }));

  // ── Merge by sortKey desc, slice to limit ─────────────────────────────────
  const merged = [...normalisedAllPosts, ...normalisedPockets]
    .sort((a, b) => b._sortKey - a._sortKey)
    .slice(0, limit);

  if (merged.length === 0) {
    return { posts: [], nextCursor: null };
  }

  // ── Enrich isLiked for AllPost items ─────────────────────────────────────
  if (userId) {
    const allPostIds = merged
      .filter((p) => p.type !== "pocket_update")
      .map((p) => p._id);

    if (allPostIds.length) {
      const userLikes = await Like.find({
        user: userId,
        post: { $in: allPostIds },
      }).select("post").lean();

      const likedSet = new Set(userLikes.map((l) => l.post.toString()));
      merged.forEach((p) => {
        if (p.type !== "pocket_update") {
          p.isLiked = likedSet.has(p._id.toString());
        }
      });
    }
  }

  // ── Build nextCursor from the last item in the merged page ────────────────
  const last = merged[merged.length - 1];
  const nextCursor = `${last._cursorType}:${last._cursorVal}`;

  // Strip internal merge fields before sending to client
  const posts = merged.map(({ _sortKey, _cursorType, _cursorVal, ...rest }) => rest);

  return { posts, nextCursor };
}