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
// router.post('/', authMiddleware, async (req, res) => {
//   try {
//     const { postId } = req.body; 
//     const userId = req.user.id;

//     // Check if the user already liked the post
//     const existingLike = await Like.findOne({ post: postId, user: userId });
//     if (existingLike) return res.status(400).json({ message: 'Already liked' });

//     // Create new like
//     const like = new Like({ post: postId, user: userId });
//     await like.save();
//     // 3. Find post owner (recipient)
//     const post = await AllPost.findById(postId);

//     if (!post)
//       return res.status(404).json({ message: "Post not found" });

//     const recipientId = post.user;

//     // 4. Prevent self-notification
//     if (recipientId.toString() !== userId.toString()) {
//       // 5. Push event into SQS
//       await sendEventToQueue({
//         type: "LIKE",
//         actorId: userId,
//         recipientId,
//         postId,
//         timestamp: Date.now(),
//       });
//       console.log("Event pushed into SQS");
//     }
//     // UPDATE USER INTERACTION
//     // await updateInteraction(userId, postId, { liked: true });
//     res.status(200).json({ message: 'Post liked successfully' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });
// router.delete('/', authMiddleware, async (req, res) => {
//   try {
//     const { postId } = req.body;
//     const userId = req.user.id;

//     const like = await Like.findOneAndDelete({ post: postId, user: userId });

//     if (!like) return res.status(404).json({ message: 'Like not found' });
//     // // UPDATE USER INTERACTION
//     // await updateInteraction(userId, postId, { liked: false });
//     res.status(200).json({ message: 'Post unliked successfully' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });
// Check if user has liked a post
router.get('/check', authMiddleware, async (req, res) => {
  try {
    const postId = req.query.postId;
    const userId = req.user.id;

    const like = await Like.findOne({ post: postId, user: userId });

    res.status(200).json({ liked: !!like });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});
// GET /api/likes/count?postId=123
router.get("/count", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.query;
    const count = await Like.countDocuments({ post: postId });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: "Failed to get like count" });
  }
});


export default router;
