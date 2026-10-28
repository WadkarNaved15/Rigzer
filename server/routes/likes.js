
import express from "express";
import mongoose from "mongoose";
import Like from "../models/Like.js";
import AllPost from "../models/Allposts.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import {
  insertFeedback,
  deleteFeedback,
  fireAndForget,
} from "../services/gorse.client.js";
import {
  onLikeAdded,
  onLikeRemoved,
} from "../services/analyticsEvents.js";
import { sendEventToQueue } from "../utils/sendEventToQueue.js";

const router = express.Router();

class PostNotFoundError extends Error {
  constructor() {
    super("Post not found");
    this.name = "PostNotFoundError";
  }
}

// LIKE
router.post("/", authMiddleware, async (req, res) => {
  const { postId } = req.body;
  const userId = req.user.id;

  if (!mongoose.isValidObjectId(postId)) {
    return res.status(400).json({ message: "Invalid postId" });
  }

  let session;

  try {
    session = await mongoose.startSession();

    let updatedPost;

    try {
      await session.withTransaction(async () => {
        // Reset values because withTransaction may retry its callback.
        updatedPost = null;

        const post = await AllPost.findById(postId)
          .select("user likesCount")
          .session(session)
          .lean();

        if (!post) {
          throw new PostNotFoundError();
        }

        // Both writes belong to the same transaction.
        const like = new Like({
          post: postId,
          user: userId,
        });

        await like.save({ session });

        updatedPost = await AllPost.findByIdAndUpdate(
          postId,
          { $inc: { likesCount: 1 } },
          { new: true, session }
        ).select("user likesCount");

        if (!updatedPost) {
          throw new PostNotFoundError();
        }
      });
    } catch (err) {
      // A duplicate means this user has already liked this post.
      // No analytics or Gorse feedback should be emitted for a duplicate.
      if (err.code === 11000) {
        const existingPost = await AllPost.findById(postId)
          .select("likesCount")
          .lean();

        if (!existingPost) {
          return res.status(404).json({ message: "Post not found" });
        }

        return res.status(200).json({
          success: true,
          isLiked: true,
          likesCount: existingPost.likesCount ?? 0,
        });
      }

      if (err instanceof PostNotFoundError) {
        return res.status(404).json({ message: "Post not found" });
      }

      throw err;
    } finally {
      await session.endSession();
    }

    // The transaction has committed successfully.
    // Side effects run only for a newly created Like.
    if (updatedPost.user.toString() !== userId.toString()) {
      void sendEventToQueue({
        type: "LIKE",
        actorId: userId,
        recipientId: updatedPost.user,
        postId,
        timestamp: Date.now(),
      }).catch((err) =>
        console.error("Like notification enqueue failed:", err)
      );
    }

    void onLikeAdded(postId).catch((err) =>
      console.error("Like analytics failed:", err)
    );

    fireAndForget(() =>
      insertFeedback({ feedbackType: "like", userId, postId })
    );

    return res.status(200).json({
      success: true,
      isLiked: true,
      likesCount: updatedPost.likesCount,
    });
  } catch (err) {
    console.error("Like request failed:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// UNLIKE
router.delete("/", authMiddleware, async (req, res) => {
  const { postId } = req.body;
  const userId = req.user.id;

  if (!mongoose.isValidObjectId(postId)) {
    return res.status(400).json({ message: "Invalid postId" });
  }

  let session;

  try {
    session = await mongoose.startSession();

    let didUnlike = false;
    let likesCount = 0;

    try {
      await session.withTransaction(async () => {
        // Reset values because withTransaction may retry its callback.
        didUnlike = false;
        likesCount = 0;

        const post = await AllPost.findById(postId)
          .select("likesCount")
          .session(session)
          .lean();

        if (!post) {
          throw new PostNotFoundError();
        }

        const deleted = await Like.findOneAndDelete({
          post: postId,
          user: userId,
        }).session(session);

        // Idempotent DELETE: the post is already unliked.
        if (!deleted) {
          likesCount = post.likesCount ?? 0;
          return;
        }

        const updatedPost = await AllPost.findByIdAndUpdate(
          postId,
          { $inc: { likesCount: -1 } },
          { new: true, session }
        ).select("likesCount");

        if (!updatedPost) {
          throw new PostNotFoundError();
        }

        likesCount = updatedPost.likesCount ?? 0;
        didUnlike = true;
      });
    } catch (err) {
      if (err instanceof PostNotFoundError) {
        return res.status(404).json({ message: "Post not found" });
      }

      throw err;
    } finally {
      await session.endSession();
    }

    // Only emit side effects if a Like was actually deleted and
    // the transaction committed successfully.
    if (didUnlike) {
      void onLikeRemoved(postId).catch((err) =>
        console.error("Unlike analytics failed:", err)
      );

      fireAndForget(() =>
        deleteFeedback({ feedbackType: "like", userId, postId })
      );
    }

    return res.status(200).json({
      success: true,
      isLiked: false,
      likesCount,
    });
  } catch (err) {
    console.error("Unlike request failed:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
