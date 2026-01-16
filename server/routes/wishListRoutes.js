import express from "express";
import Wishlist from "../models/Wishlist.js";
import verifyToken from "../middlewares/authMiddleware.js";

const router = express.Router();

// Check if wishlisted
router.get("/check", verifyToken, async (req, res) => {
  const { postId } = req.query;

  const exists = await Wishlist.findOne({
    post: postId,
    user: req.user.id,
  });

  res.json({ wishlisted: !!exists });
});
//Fetch all wishlisted posts
router.get("/mine",verifyToken, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    const wishlisted = await Wishlist.find({ user: req.user.id })
      .populate({
        path: "post",
        populate: { path: "user", select: "username" }
      })
      .sort({ createdAt: -1 });

    const posts = wishlisted.map(w => w.post);

    return res.json(posts);
  } catch (err) {
    console.error("Wishlist fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// Add to wishlist
router.post("/", verifyToken, async (req, res) => {
  const { postId } = req.body;

  const exists = await Wishlist.findOne({
    post: postId,
    user: req.user.id,
  });

  if (exists) return res.json({ message: "Already wishlisted" });

  await Wishlist.create({
    post: postId,
    user: req.user.id,
  });

  res.json({ message: "Added to wishlist" });
});

// Remove from wishlist
router.delete("/", verifyToken, async (req, res) => {
  const { postId } = req.body;

  await Wishlist.findOneAndDelete({
    post: postId,
    user: req.user.id,
  });

  res.json({ message: "Removed from wishlist" });
});

export default router;
