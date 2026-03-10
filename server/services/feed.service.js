// services/feed.service.js
// Cursor-based feed merge — matches the _id cursor pattern in posts.js.
// Called by the /api/posts/fetch_posts route instead of querying AllPost directly.

import AllPost         from "../models/Allposts.js";
import PocketFeedEntry from "../models/PocketFeedEntry.js";
import Like            from "../models/Like.js";

/**
 * Merged, cursor-paginated feed.
 *
 * Strategy: over-fetch from both collections, merge by _id desc
 * (ObjectId timestamps are monotonically increasing, so _id sort ≡ createdAt sort),
 * then slice to `limit`. The nextCursor returned is the last _id in the merged slice.
 *
 * @param {{ cursor?: string, limit?: number, userId?: string }} opts
 * @returns {Promise<{ posts: object[], nextCursor: string|null }>}
 */
export async function getFeedPage({ cursor, limit = 10, userId } = {}) {
  const idFilter = cursor ? { _id: { $lt: cursor } } : {};

  // Over-fetch from both so the merge has enough to fill `limit` after sorting.
  // 2× is conservative; increase if pocket density is high.
  const fetchLimit = limit * 2;

  const [allPosts, pocketEntries] = await Promise.all([
    AllPost.find({
      ...idFilter,
      type: { $ne: "canvas_article" },
    })
      .populate("user", "username avatar")
      .sort({ _id: -1 })
      .limit(fetchLimit)
      .lean(),

    PocketFeedEntry.find(idFilter)
      .populate("owner", "username avatar")
      .sort({ _id: -1 })
      .limit(limit)          // pockets are sparse — no need to over-fetch
      .lean(),
  ]);

  // Normalise pocket entries to match AllPost shape expected by the frontend
  const normalisedPockets = pocketEntries.map((e) => ({
    _id:               e._id,
    createdAt:         e.createdAt,
    updatedAt:         e.updatedAt,
    type:              "pocket_update",   // Post.tsx dispatches on this
    user:              e.owner,           // same prop name as AllPost
    likesCount:        e.likesCount,
    commentsCount:     e.commentsCount,
    isLiked:           false,             // enriched below
    // Pocket-specific — read by PocketPost.tsx directly from top-level props
    brandName:         e.brandName,
    tagline:           e.tagline,
    compiledBundleUrl: e.compiledBundleUrl,
    // Keep reference for analytics
    _pocketEntryId:    e._id,
  }));

  // Merge and sort by _id descending, slice to limit
  const merged = [...allPosts, ...normalisedPockets]
    .sort((a, b) => (a._id < b._id ? 1 : a._id > b._id ? -1 : 0))
    .slice(0, limit);

  if (merged.length === 0) {
    return { posts: [], nextCursor: null };
  }

  // Enrich isLiked for the AllPost items (pocket entries use their own like model)
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

  return {
    posts:      merged,
    nextCursor: merged[merged.length - 1]._id,
  };
}