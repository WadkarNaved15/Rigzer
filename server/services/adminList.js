// services/adminListService.js
//
// Source-of-truth mapping enforced:
//   AllPost.viewsCount / uniqueViewsCount  → totalViews, post rankings, creator views
//   Like collection                        → totalLikes in user/creator stats
//   Comment collection                     → totalComments in user/creator stats
//   GameSession                            → all session metrics (games, creators)
//   UserSession                            → (not used in list queries)
//   UserActivityEvent                      → not used here; behavioral only

import mongoose from "mongoose";
import AllPost   from "../models/Allposts.js";
import User      from "../models/User.js";
import Like      from "../models/Like.js";
import Comment   from "../models/Comment.js";
import GameSession from "../models/GameSession.js";
import { parseDateRange } from "../utils/dateRange.js";
import PostAnalytics from "../models/postAnalytics.js";

// ─── Users ────────────────────────────────────────────────────────────────────

export async function listUsers({
  page = 1, pageSize = 20,
  search, role, verified,
  range, from, to,
} = {}) {
  const { dateMatch } = parseDateRange({ range, from, to });
  const match = { ...dateMatch };

  if (role && role !== "all") match.role = role;
  if (verified === "true")    match.isVerified = true;
  if (verified === "false")   match.isVerified = false;

  if (search) {
    const re = { $regex: search, $options: "i" };
    match.$or = [{ username: re }, { email: re }];
  }

  const [countResult, users] = await Promise.all([
    User.countDocuments(match),
    User.find(match)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);

  const userIds = users.map(u => u._id);


  // Post-level stats from AllPost (views only — AllPost is source of truth for views)
  const postStats = await AllPost.aggregate([
    { $match: { user: { $in: userIds } } },
    {
      $group: {
        _id:        "$user",
        postsCount: { $sum: 1 },
        totalViews: { $sum: "$viewsCount" },
        gamesCount: { $sum: { $cond: [{ $eq: ["$type", "game_post"] }, 1, 0] } },

        // Collect post IDs for Like/Comment lookup below
        postIds:    { $push: "$_id" },
      },
    },
  ]);

  // Collect all post IDs across all users for a single Like/Comment pass
  const allPostIds = postStats.flatMap(p => p.postIds);

  // FIX: totalLikes from Like collection (authoritative)
  // FIX: totalComments from Comment collection (authoritative)
  // FIX: totalShares from Share collection (authoritative)
  const [likeAgg, commentAgg, shareAgg] = await Promise.all([
    Like.aggregate([
      { $match: { post: { $in: allPostIds } } },
      { $group: { _id: "$post", count: { $sum: 1 } } },
    ]),
    Comment.aggregate([
      { $match: { post: { $in: allPostIds } } },
      { $group: { _id: "$post", count: { $sum: 1 } } },
    ]),
    PostAnalytics.aggregate([
      { $match: { post: { $in: allPostIds } } },
      { $group: { _id: "$post", shares: { $sum: "$lifetime.shares" } } },
    ]),
  ]);

  // Build post→likes and post→comments maps
  const likeByPost    = new Map(likeAgg.map(l => [String(l._id), l.count]));
  const commentByPost = new Map(commentAgg.map(c => [String(c._id), c.count]));
  const sharesByPost = new Map(
  shareAgg.map(s => [String(s._id), s.shares])
);



  // Roll up likes/comments per user
  const psMap = new Map();
  for (const ps of postStats) {
    const totalLikes    = ps.postIds.reduce((s, id) => s + (likeByPost.get(String(id))    ?? 0), 0);
    const totalComments = ps.postIds.reduce((s, id) => s + (commentByPost.get(String(id)) ?? 0), 0);
    const totalShares = ps.postIds.reduce(
  (s, id) => s + (sharesByPost.get(String(id)) ?? 0),
  0
);
    
    psMap.set(String(ps._id), {
      postsCount:    ps.postsCount,
      totalViews:    ps.totalViews,
      totalLikes,
      totalComments,
      totalShares,
      gamesCount:    ps.gamesCount,
    });
  }

  const rows = users.map(u => ({
    _id:              String(u._id),
    username:         u.username,
    email:            u.email,
    role:             u.role,
    isVerified:       u.isVerified,
    isPocketEligible: u.isPocketEligible,
    followersCount:   u.followersCount,
    followingCount:   u.followingCount,
    createdAt:        u.createdAt,
    updatedAt:        u.updatedAt,
    postStats:        psMap.get(String(u._id)) ?? {
      postsCount: 0, totalViews: 0, totalLikes: 0, totalComments: 0,totalShares: 0, gamesCount: 0,
    },
  }));

  const total = countResult;
  return { rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ─── Posts ────────────────────────────────────────────────────────────────────

const SORTABLE_POST_FIELDS = {
  createdAt:     "createdAt",
  viewsCount:    "viewsCount",
  likesCount:    "likesCount",
  commentsCount: "commentsCount",
};

export async function listPosts({
  page = 1, pageSize = 20,
  search, type,
  sortBy = "createdAt",
  range, from, to,
} = {}) {
  const { dateMatch } = parseDateRange({ range, from, to });
  const match = { ...dateMatch };

  if (type && type !== "all") match.type = type;

  if (search) {
    const re = { $regex: search, $options: "i" };
    match.$or = [
      { description: re },
      { "gamePost.gameName": re },
      { "modelPost.title": re },
      { "adModelPost.brandName": re },
      { "mediaAdPost.brandName": re },
    ];
  }

  const sortField = SORTABLE_POST_FIELDS[sortBy] ?? "createdAt";

  // NOTE: Posts table uses AllPost.viewsCount / uniqueViewsCount / likesCount / commentsCount
  // for display purposes only (per-row counters, not platform totals).
  // Platform-level totals must always use Like/Comment collections.
  const [total, rows] = await Promise.all([
    AllPost.countDocuments(match),
    AllPost.aggregate([
      { $match: match },
      { $sort: { [sortField]: -1 } },
      { $skip: (page - 1) * pageSize },
      { $limit: pageSize },
      {
        $lookup: {
          from:     "users",
          localField: "user",
          foreignField: "_id",
          as:       "creator",
          pipeline: [{ $project: { username: 1 } }],
        },
      },
      {
        $lookup: {
          from: "postanalytics",
          localField: "_id",
          foreignField: "post",
          as: "analytics",
        },
      },
      {
        $addFields: {
          analytics: {
            $arrayElemAt: ["$analytics", 0],
          },
        },
      },
      {
        $project: {
          type: 1, createdAt: 1,
          viewsCount: 1, uniqueViewsCount: 1,
          // likesCount / commentsCount kept for per-row display only
          likesCount: 1, commentsCount: 1,
          sharesCount: {
            $ifNull: [
              "$analytics.lifetime.shares",
              0,
            ],
          },
          description: 1,
          gamePost:    { gameName: "$gamePost.gameName" },
          modelPost:   { title: "$modelPost.title" },
          adModelPost: { brandName: "$adModelPost.brandName" },
          mediaAdPost: { brandName: "$mediaAdPost.brandName" },
          creator:     { $arrayElemAt: ["$creator", 0] },
        },
      },
    ]),
  ]);

  return { rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ─── Creators ─────────────────────────────────────────────────────────────────

export async function listCreators({
  page = 1, pageSize = 20,
  rankBy = "views",
  range, from, to,
} = {}) {
  const { dateMatch } = parseDateRange({ range, from, to });

  // Step 1: aggregate per-creator post metrics from AllPost
  // views → AllPost.viewsCount (authoritative)
  // likes/comments → resolved from Like/Comment collections below
  const postGroupPipeline = [
    { $match: { ...dateMatch } },
    {
      $group: {
        _id:        "$user",
        totalViews: { $sum: "$viewsCount" },
        postsCount: { $sum: 1 },
        gamesCount: { $sum: { $cond: [{ $eq: ["$type", "game_post"] }, 1, 0] } },
        postIds:    { $push: "$_id" },
      },
    },
  ];

  const useSessionSort  = rankBy === "sessions";
  const useFollowerSort = rankBy === "followers";
  const useLikeSort     = rankBy === "likes";

  // Rank field for non-session, non-follower, non-like sorts
  const rankField = { views: "totalViews", posts: "postsCount" }[rankBy] ?? "totalViews";

  // Fetch all creator groups first (we need post IDs for Like/Comment lookup)
  const allCreatorGroups = await AllPost.aggregate(postGroupPipeline);

  // Collect all post IDs across all creators for a single Like/Comment pass
  const allPostIds = allCreatorGroups.flatMap(g => g.postIds);

  // FIX: totalLikes from Like collection (authoritative)
  // FIX: totalComments from Comment collection (authoritative)
  // FIX: totalShares from Share collection (authoritative)
  const [likeAgg, commentAgg, shareAgg] = await Promise.all([
    Like.aggregate([
      { $match: { post: { $in: allPostIds } } },
      { $group: { _id: "$post", count: { $sum: 1 } } },
    ]),
    Comment.aggregate([
      { $match: { post: { $in: allPostIds } } },
      { $group: { _id: "$post", count: { $sum: 1 } } },
    ]),
    PostAnalytics.aggregate([
  {
    $match: {
      post: { $in: allPostIds },
    },
  },
  {
    $project: {
      post: 1,
      shares: "$lifetime.shares",
    },
  },
])
  ]);

  const likeByPost    = new Map(likeAgg.map(l => [String(l._id), l.count]));
  const commentByPost = new Map(commentAgg.map(c => [String(c._id), c.count]));
  const sharesByPost = new Map(
  shareAgg.map(s => [String(s.post), s.shares])
);



  // Build creator-level stat map with authoritative like/comment counts
  const creatorStatMap = new Map();
  for (const g of allCreatorGroups) {
    const totalLikes    = g.postIds.reduce((s, id) => s + (likeByPost.get(String(id))    ?? 0), 0);
    const totalComments = g.postIds.reduce((s, id) => s + (commentByPost.get(String(id)) ?? 0), 0);
    const totalShares = g.postIds.reduce(
      (sum, id) =>
        sum + (sharesByPost.get(String(id)) ?? 0),
      0
    );
    creatorStatMap.set(String(g._id), {
      totalViews:    g.totalViews,
      totalLikes,
      totalComments,
      totalShares,
      postsCount:    g.postsCount,
      gamesCount:    g.gamesCount,
      postIds:       g.postIds,
    });
  }

  // Hydrate with user docs for follower count, display fields
  const creatorIds = allCreatorGroups.map(g => g._id).filter(Boolean);
  const userDocs   = await User.find(
    { _id: { $in: creatorIds } },
    { username: 1, email: 1, avatar: 1, followersCount: 1, isVerified: 1, createdAt: 1 }
  ).lean();
  const userDocMap = new Map(userDocs.map(u => [String(u._id), u]));

  // Merge and sort
  let merged = allCreatorGroups.map(g => {
    const uid   = String(g._id);
    const stats = creatorStatMap.get(uid) ?? {};
    const doc   = userDocMap.get(uid)     ?? {};
    return {
      _id:            uid,
      username:       doc.username       ?? "—",
      email:          doc.email          ?? "—",
      avatar:         doc.avatar,
      followersCount: doc.followersCount ?? 0,
      isVerified:     doc.isVerified     ?? false,
      createdAt:      doc.createdAt,
      totalViews:     stats.totalViews    ?? 0,
      totalLikes:     stats.totalLikes    ?? 0,
      totalComments:  stats.totalComments ?? 0,
      totalShares:    stats.totalShares ?? 0,
      postsCount:     stats.postsCount    ?? 0,
      gamesCount:     stats.gamesCount    ?? 0,
      // session stats filled below
      totalSessions:  0,
      totalPlayTime:  0,
      postIds:        g.postIds,
    };
  });

  // Session stats per creator (GameSession — authoritative)
  const gamePostIds  = merged.flatMap(c => c.postIds.filter(id => {
    // We only pass game post IDs; we need to know which posts are game_post type.
    // Since we already have postIds per creator, we look them up via AllPost.
    return false; // resolved separately below
  }));

  // Re-fetch game post IDs per creator for session lookup
  const gamePostMap = await AllPost.aggregate([
    { $match: { user: { $in: creatorIds }, type: "game_post" } },
    { $group: { _id: "$user", gamePostIds: { $push: "$_id" } } },
  ]);
  const creatorGamePostMap = new Map(gamePostMap.map(g => [String(g._id), g.gamePostIds]));

  const allGamePostIds = gamePostMap.flatMap(g => g.gamePostIds);

  const sessionAgg = await GameSession.aggregate([
    { $match: { gamePost: { $in: allGamePostIds } } },
    {
      $lookup: {
        from:     "allposts",
        localField: "gamePost",
        foreignField: "_id",
        as:       "gp",
        pipeline: [{ $project: { user: 1 } }],
      },
    },
    { $addFields: { creatorId: { $arrayElemAt: ["$gp.user", 0] } } },
    {
      $group: {
        _id:           "$creatorId",
        totalSessions: { $sum: 1 },
        totalPlayTime: { $sum: "$metrics.totalPlayTime" },
      },
    },
  ]);
  const sessionMap = new Map(sessionAgg.map(s => [String(s._id), s]));

  // Attach session stats and remove internal postIds field
  merged = merged.map(c => {
    const ss = sessionMap.get(c._id);
    const { postIds: _dropped, ...rest } = c;
    return {
      ...rest,
      totalSessions: ss?.totalSessions ?? 0,
      totalPlayTime: ss?.totalPlayTime ?? 0,
    };
  });

  // Sort
  const sortFns = {
    views:     (a, b) => b.totalViews     - a.totalViews,
    likes:     (a, b) => b.totalLikes     - a.totalLikes,
    comments:  (a, b) => b.totalComments  - a.totalComments,
    shares: (a, b) => b.totalShares - a.totalShares,
    posts:     (a, b) => b.postsCount     - a.postsCount,
    followers: (a, b) => b.followersCount - a.followersCount,
    sessions:  (a, b) => b.totalSessions  - a.totalSessions,
  };
  if (sortFns[rankBy]) merged.sort(sortFns[rankBy]);

  const total = merged.length;
  const rows  = merged.slice((page - 1) * pageSize, page * pageSize);

  return { rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

// ─── Games ────────────────────────────────────────────────────────────────────

export async function listGames({
  page = 1, pageSize = 20,
  search, sortBy = "sessions",
  range, from, to,
} = {}) {
  const { dateMatch: sessionDateMatch } = parseDateRange({ range, from, to });

  const match = { type: "game_post" };
  if (search) {
    match.$or = [
      { "gamePost.gameName": { $regex: search, $options: "i" } },
    ];
  }

  const [totalCount, gamePosts] = await Promise.all([
    AllPost.countDocuments(match),
    AllPost.find(match)
      .sort({ ...(sortBy === "views" ? { viewsCount: -1 } : { createdAt: -1 }) })
      .lean(),
  ]);

  const gameIds = gamePosts.map(g => g._id);

  // Session stats per game (GameSession — authoritative)
  const sessionStats = await GameSession.aggregate([
    { $match: { gamePost: { $in: gameIds }, ...sessionDateMatch } },
    {
      $group: {
        _id:           "$gamePost",
        totalSessions: { $sum: 1 },
        uniquePlayers: { $addToSet: "$user" },
        totalPlayTime: { $sum: "$metrics.totalPlayTime" },
        totalCredits:  { $sum: "$billing.creditsConsumed" },
        failures:      { $sum: { $cond: [{ $eq: ["$status",     "failed"] }, 1, 0] } },
        crashes:       { $sum: { $cond: [{ $eq: ["$exitReason", "crash"]  }, 1, 0] } },
      },
    },
  ]);
  const ssMap = new Map(sessionStats.map(s => [String(s._id), s]));

  // Creator lookup
  const creatorIds = [...new Set(gamePosts.map(g => String(g.user)))];
  const creators = await User.find(
    { _id: { $in: creatorIds.map(id => new mongoose.Types.ObjectId(id)) } }
  ).select("username").lean();
  const creatorMap = new Map(creators.map(c => [String(c._id), c.username]));

  let rows = gamePosts.map(g => {
    const ss    = ssMap.get(String(g._id));
    const total = ss?.totalSessions ?? 0;
    return {
      _id:     String(g._id),
      gamePost: {
        gameName:     g.gamePost?.gameName,

        verification: {
          status: g.gamePost?.verification?.status,
        },

        visibility: g.gamePost?.visibility,

        creditBudget: {
          status: g.gamePost?.creditBudget?.status,
        },

        snapshot: {
          status: g.gamePost?.snapshot?.status ?? "pending",

          sourceRegion:
            g.gamePost?.snapshot?.sourceRegion ?? null,

          sourceSnapshotId:
            g.gamePost?.snapshot?.sourceSnapshotId ?? null,

          regions: Array.isArray(g.gamePost?.snapshot?.regions)
            ? g.gamePost.snapshot.regions.map(region => ({
                region: region.region,
                snapshotId: region.snapshotId ?? null,
                status: region.status ?? "pending",
                error: region.error ?? null,
                createdAt: region.createdAt ?? null,
                completedAt: region.completedAt ?? null,
              }))
            : [],
        },
      },
      creator:    { username: creatorMap.get(String(g.user)) ?? "—" },
      // views from AllPost.viewsCount (authoritative)
      viewsCount: g.viewsCount,
      likesCount: g.likesCount,
      createdAt:  g.createdAt,
      sessionStats: ss ? {
        totalSessions: total,
        uniquePlayers: ss.uniquePlayers?.length ?? 0,
        totalPlayTime: ss.totalPlayTime,
        totalCredits:  ss.totalCredits,
        failureRate:   total > 0 ? parseFloat((ss.failures / total * 100).toFixed(1)) : 0,
        crashRate:     total > 0 ? parseFloat((ss.crashes  / total * 100).toFixed(1)) : 0,
      } : null,
    };
  });

  // Sort
  const sortFns = {
    sessions:    (a, b) => (b.sessionStats?.totalSessions ?? 0) - (a.sessionStats?.totalSessions ?? 0),
    players:     (a, b) => (b.sessionStats?.uniquePlayers ?? 0) - (a.sessionStats?.uniquePlayers ?? 0),
    credits:     (a, b) => (b.sessionStats?.totalCredits  ?? 0) - (a.sessionStats?.totalCredits  ?? 0),
    failureRate: (a, b) => (b.sessionStats?.failureRate   ?? 0) - (a.sessionStats?.failureRate   ?? 0),
    views:       (a, b) => b.viewsCount - a.viewsCount,
  };
  if (sortFns[sortBy]) rows.sort(sortFns[sortBy]);

  const paged = rows.slice((page - 1) * pageSize, page * pageSize);

  return { rows: paged, total: totalCount, page, pageSize, totalPages: Math.ceil(totalCount / pageSize) };
}

// ─── Models ───────────────────────────────────────────────────────────────────

export async function listModels({
  page = 1, pageSize = 20,
  sortBy = "views",
  range, from, to,
} = {}) {
  const { dateMatch } = parseDateRange({ range, from, to });
  const sortField = { views: "viewsCount", likes: "likesCount", comments: "commentsCount" }[sortBy] ?? "viewsCount";

  const match = { type: "model_post", ...dateMatch };

  const [total, rows] = await Promise.all([
    AllPost.countDocuments(match),
    AllPost.aggregate([
      { $match: match },
      { $sort: { [sortField]: -1 } },
      { $skip: (page - 1) * pageSize },
      { $limit: pageSize },
      {
        $lookup: {
          from:     "users",
          localField: "user",
          foreignField: "_id",
          as:       "creator",
          pipeline: [{ $project: { username: 1 } }],
        },
      },
      {
        $project: {
          viewsCount: 1, uniqueViewsCount: 1, likesCount: 1, commentsCount: 1, createdAt: 1,
          modelPost: {
            title: "$modelPost.title",
            price: "$modelPost.price",
            assets: { $size: { $ifNull: ["$modelPost.assets", []] } },
          },
          creator: { $arrayElemAt: ["$creator", 0] },
        },
      },
    ]),
  ]);

  return { rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}