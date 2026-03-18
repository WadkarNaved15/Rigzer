import express from "express";
import Wishlist from "../models/Wishlist.js";
import verifyToken from "../middlewares/authMiddleware.js";

const router = express.Router();

//Fetch all wishlisted posts
router.get("/mine", verifyToken, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { cursor, limit = 10 } = req.query;

    let filter = { user: req.user.id };

    // 🔥 Cursor logic
    if (cursor) {
      filter._id = { $lt: cursor };
    }

    const wishlisted = await Wishlist.find(filter)
      .sort({ _id: -1 }) // 🔥 important for cursor
      .limit(parseInt(limit))
      .populate({
        path: "post",
        populate: { path: "user", select: "username avatar" },
      })
      .lean();

    // Extract posts
    const posts = wishlisted
      .map((w) => w.post)
      .filter(Boolean);

    // 🔥 next cursor
    const nextCursor =
      wishlisted.length > 0
        ? wishlisted[wishlisted.length - 1]._id
        : null;

    return res.json({
      posts,
      nextCursor,
    });
  } catch (err) {
    console.error("Wishlist fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// Add to wishlist
router.post("/", verifyToken, async (req, res) => {
  try {
    const { postId } = req.body;

    await Wishlist.create({
      post: postId,
      user: req.user.id,
    });

    res.json({ success: true });

  } catch (err) {
    if (err.code === 11000) {
      return res.json({ message: "Already wishlisted" });
    }

    res.status(500).json({ message: "Server error" });
  }
});

// Remove from wishlist
router.delete("/", verifyToken, async (req, res) => {
  const { postId } = req.body;

  await Wishlist.deleteOne({
    post: postId,
    user: req.user.id,
  });

  res.json({ success: true });
});

export default router;
