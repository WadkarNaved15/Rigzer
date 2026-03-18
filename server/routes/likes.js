import express from 'express';
import Like from '../models/Like.js';
import { sendEventToQueue } from "../utils/sendEventToQueue.js";
import AllPost from "../models/Allposts.js"; // post model
// import { updateInteraction } from "../helper/interactionController.js";
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

// Like a post
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.body;
    const userId = req.user.id;

    // Create like (unique index prevents duplicate)
    await Like.create({ post: postId, user: userId });

    // Increment counter
    const updatedPost = await AllPost.findByIdAndUpdate(
      postId,
      { $inc: { likesCount: 1 } },
      { new: true }
    );

    if (!updatedPost) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Send notification async (do NOT block response)
    if (updatedPost.user.toString() !== userId.toString()) {
      sendEventToQueue({
        type: "LIKE",
        actorId: userId,
        recipientId: updatedPost.user,
        postId,
        timestamp: Date.now(),
      }).catch(console.error);
    }

    res.status(200).json({
      success: true,
      likesCount: updatedPost.likesCount,
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Already liked" });
    }

    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

//Unlike a post 
router.delete("/", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.body;
    const userId = req.user.id;

    const deleted = await Like.findOneAndDelete({
      post: postId,
      user: userId,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Like not found" });
    }

    const updatedPost = await AllPost.findByIdAndUpdate(
      postId,
      { $inc: { likesCount: -1 } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      likesCount: updatedPost.likesCount,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
