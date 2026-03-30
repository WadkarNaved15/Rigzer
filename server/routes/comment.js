// routes/comment.js — Gorse feedback hook on comment creation only
// Only the POST route changes. GET and DELETE are unchanged.
import express from "express";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import Comment from "../models/Comment.js";
import AllPost from "../models/Allposts.js";
import { sendEventToQueue } from "../utils/sendEventToQueue.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import { insertFeedback, fireAndForget } from "../services/gorse.client.js";

const router = express.Router();

const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: "Too many comments. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Add comment ───────────────────────────────────────────────────────────────
router.post("/", authMiddleware, commentLimiter, async (req, res) => {
  try {
    const { postId, text } = req.body;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }
    if (!text?.trim()) {
      return res.status(400).json({ message: "Comment cannot be empty" });
    }
    if (text.length > 2000) {
      return res.status(400).json({ message: "Comment too long" });
    }

    const comment = await Comment.create({
      post: postId,
      user: userId,
      text: text.trim(),
    });

    const post = await AllPost.findByIdAndUpdate(
      postId,
      { $inc: { commentsCount: 1 } },
      { new: true }
    ).select("user commentsCount");

    if (!post) {
      await Comment.deleteOne({ _id: comment._id });
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.user.toString() !== userId) {
      sendEventToQueue({
        type: "COMMENT",
        actorId: userId,
        recipientId: post.user,
        postId,
        commentId: comment._id,
        createdAt: new Date(),
      }).catch(console.error);
    }

    // ✅ Gorse: a comment is strong engagement signal
    fireAndForget(() =>
      insertFeedback({ feedbackType: "comment", userId, postId })
    );

    const populatedComment = await Comment.findById(comment._id)
      .populate("user", "username avatar")
      .lean();

    res.status(201).json({
      comment: populatedComment,
      commentsCount: post.commentsCount,
    });

  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── Get comments (unchanged) ──────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { postId, cursor, limit = 20 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const parsedLimit = Math.min(Number(limit) || 20, 50);
    const query = {
      post: postId,
      ...(cursor && mongoose.Types.ObjectId.isValid(cursor) && {
        _id: { $lt: cursor },
      }),
    };

    const comments = await Comment.find(query)
      .populate("user", "username avatar")
      .sort({ _id: -1 })
      .limit(parsedLimit)
      .lean();

    const nextCursor = comments.length > 0 ? comments[comments.length - 1]._id : null;
    res.json({ comments, nextCursor });

  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ── Delete comment (unchanged) ────────────────────────────────────────────────
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const commentId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: "Invalid comment ID" });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    if (comment.user.toString() !== userId) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await Comment.deleteOne({ _id: comment._id });
    await AllPost.findByIdAndUpdate(comment.post, { $inc: { commentsCount: -1 } });

    res.json({ message: "Comment deleted" });

  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;