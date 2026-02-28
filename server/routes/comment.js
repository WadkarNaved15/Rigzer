import express from "express";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import Comment from "../models/Comment.js";
import AllPost from "../models/Allposts.js";
import { sendEventToQueue } from "../utils/sendEventToQueue.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

/* ==============================
   RATE LIMITER (Comment creation)
============================== */

const commentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 comments per minute per IP
  message: { message: "Too many comments. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

/* ==============================
   ➕ ADD COMMENT
============================== */

router.post("/", authMiddleware, commentLimiter, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { postId, text } = req.body;
    const userId = req.user.id;

    // ✅ Validate postId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Invalid post ID" });
    }

    // ✅ Validate text
    if (!text?.trim()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Comment cannot be empty" });
    }

    if (text.length > 2000) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Comment too long" });
    }

    // ✅ Create comment
    const [comment] = await Comment.create(
      [{ post: postId, user: userId, text: text.trim() }],
      { session }
    );

    // ✅ Increment comment counter
    const post = await AllPost.findByIdAndUpdate(
      postId,
      { $inc: { commentsCount: 1 } },
      { session, new: true }
    ).select("user commentsCount");

    if (!post) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Post not found" });
    }

    await session.commitTransaction();
    session.endSession();

    // ✅ Send notification AFTER commit
    if (post.user.toString() !== userId) {
      await sendEventToQueue({
        type: "COMMENT",
        actorId: userId,
        recipientId: post.user,
        postId,
        commentId: comment._id,
        createdAt: new Date(),
      });
    }

    const populatedComment = await Comment.findById(comment._id)
      .populate("user", "username avatar")
      .lean();

    res.status(201).json({
      comment: populatedComment,
      commentsCount: post.commentsCount, // 🔥 return updated count
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error adding comment:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/* ==============================
   🧾 GET COMMENTS (Cursor Pagination)
============================== */

router.get("/", async (req, res) => {
  try {
    const { postId, cursor, limit = 20 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const parsedLimit = Math.min(Number(limit) || 20, 50);

    const query = {
      post: postId,
      ...(cursor &&
        mongoose.Types.ObjectId.isValid(cursor) && {
        _id: { $lt: cursor },
      }),
    };

    const comments = await Comment.find(query)
      .populate("user", "username avatar")
      .sort({ _id: -1 })
      .limit(parsedLimit)
      .lean();

    const nextCursor =
      comments.length > 0 ? comments[comments.length - 1]._id : null;

    res.json({ comments, nextCursor });

  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/* ==============================
   ❌ DELETE COMMENT
============================== */

router.delete("/:id", authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const commentId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Invalid comment ID" });
    }

    const comment = await Comment.findById(commentId).session(session);

    if (!comment) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Comment not found" });
    }

    if (comment.user.toString() !== userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: "Not authorized" });
    }

    await Comment.deleteOne({ _id: comment._id }, { session });

    await AllPost.findByIdAndUpdate(
      comment.post,
      { $inc: { commentsCount: -1 } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Comment deleted" });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error deleting comment:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;