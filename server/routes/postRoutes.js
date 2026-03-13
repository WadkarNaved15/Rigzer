// routes/posts.js
// fetch_posts now delegates to feed.service.js for the merged feed.
// All other routes are unchanged from your original.

import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import Post from "../models/Allposts.js";
import Like from "../models/Like.js";
import optionalAuthMiddleware from "../middlewares/optionalAuthMiddleware.js";
import { getFeedPage } from "../services/feed.service.js";

dotenv.config();

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ── GET /api/posts/fetch_posts ───────────────────────────────────────────────
// Merged feed: AllPost rows + PocketFeedEntry rows, cursor-paginated.
router.get("/fetch_posts", optionalAuthMiddleware, async (req, res) => {
  try {
    const { cursor, limit = 10 } = req.query;
    const userId = req.user?.id;

    const { posts, nextCursor } = await getFeedPage({
      cursor: cursor || undefined,
      limit: Number(limit),
      userId,
    });

    res.status(200).json({ posts, nextCursor });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// ── GET /api/posts/filter_posts ──────────────────────────────────────────────
// Search via Meilisearch — pocket entries indexed separately if desired.
router.get("/filter_posts", async (req, res) => {
  try {
    const { query, cursor, limit = 10 } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({ message: "Search query is required" });
    }

    const filter = {
      $text: { $search: query },
    };

    if (cursor) {
      filter._id = { $lt: cursor };
    }

    const posts = await Post.find(
      filter,
      { score: { $meta: "textScore" } }
    )
      .populate("user", "username avatar")
      .sort({ score: { $meta: "textScore" }, _id: -1 })
      .limit(Number(limit))
      .lean();

    const nextCursor =
      posts.length === Number(limit)
        ? posts[posts.length - 1]._id
        : null;

    res.status(200).json({
      posts,
      nextCursor,
    });
  } catch (error) {
    console.error("Error filtering posts:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── GET /api/posts/user_posts/:userId ────────────────────────────────────────
// Profile page — AllPost only (pocket entries are brand-owned, not user posts).
router.get("/user_posts/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { cursor, limit = 10 } = req.query;

    const query = {
      user: userId,
      type: { $ne: "canvas_article" },
      ...(cursor && { _id: { $lt: cursor } }),
    };

    const posts = await Post.find(query)
      .populate("user", "username avatar")
      .sort({ _id: -1 })
      .limit(Number(limit))
      .lean();

    res.status(200).json({
      posts,
      nextCursor: posts.length ? posts[posts.length - 1]._id : null,
    });
  } catch (err) {
    console.error("Error fetching user posts:", err);
    res.status(500).json({ error: "Failed to fetch user posts" });
  }
});

// ── GET /api/posts/:postId ────────────────────────────────────────────────────
router.get("/:postId", async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId)
      .populate("user", "username avatar");
    if (!post) return res.status(404).json({ deleted: true });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

export default router;