import express from "express";
import Comment from "../models/Comment.js";
// import { updateInteraction } from "../helper/interactionController.js";
import authMiddleware from "../middlewares/authMiddleware.js"; // assuming same middleware as likes

const router = express.Router();

// ➕ Add Comment
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { postId, text } = req.body;
    const userId = req.user.id;

    if (!text.trim()) return res.status(400).json({ message: "Comment cannot be empty" });

    const comment = new Comment({ post: postId, user: userId, text });
    await comment.save();
    // UPDATE USER INTERACTION
    // await updateInteraction(userId, postId, { commented: true });
    const populatedComment = await comment.populate("user", "username");
    res.status(201).json(populatedComment);
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ message: "Server error" });
  }
}); 

// 🧾 Get Comments for a Post
router.get("/", async (req, res) => {
  try {
    const { postId } = req.query;
    const comments = await Comment.find({ post: postId })
      .populate("user", "username")
      .sort({ createdAt: -1 });
    res.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ❌ Delete Comment (optional)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const userId=req.user.id
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    if (comment.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    await comment.deleteOne();
    // UPDATE USER INTERACTION
    await updateInteraction(userId, postId, { commented: false });
    res.json({ message: "Comment deleted" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
