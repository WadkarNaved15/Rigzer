// routes/wishListRoutes.js — Gorse save/unsave feedback hooks added
import express from "express";
import mongoose from "mongoose";
import Wishlist from "../models/Wishlist.js";
import verifyToken from "../middlewares/authMiddleware.js";
import { insertFeedback, deleteFeedback, fireAndForget } from "../services/gorse.client.js";
import {
  onSaveAdded,
  onSaveRemoved,
} from "../services/analyticsEvents.js";
import { trackEvent } from "../services/analyticsService.js";

const router = express.Router();

// ── Fetch wishlisted posts (unchanged) ────────────────────────────────────────
router.get("/mine", verifyToken, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });

    const { cursor, limit = 10 } = req.query;
    let filter = { user: req.user.id };
    if (cursor) filter._id = { $lt: cursor };

    const wishlisted = await Wishlist.find(filter)
      .sort({ _id: -1 })
      .limit(parseInt(limit))
      .populate({ path: "post", populate: { path: "user", select: "username avatar" } })
      .lean();

    const posts = wishlisted.map((w) => w.post).filter(Boolean);
    const nextCursor = wishlisted.length > 0 ? wishlisted[wishlisted.length - 1]._id : null;

    return res.json({ posts, nextCursor });
  } catch (err) {
    console.error("Wishlist fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Save post ─────────────────────────────────────────────────────────────────

router.post("/", verifyToken, async (req, res) => {
  try {
    const { postId } = req.body;
    const userId = req.user.id;

    if (!mongoose.isValidObjectId(postId)) {
      return res.status(400).json({ message: "Invalid postId" });
    }

    // Create the wishlist record only if it does not already exist.
    const result = await Wishlist.updateOne(
      { post: postId, user: userId },
      {
        $setOnInsert: {
          post: postId,
          user: userId,
        },
      },
      { upsert: true }
    );

    const inserted =
      result.upsertedCount === 1 || Boolean(result.upsertedId);

    // Run analytics only when the wishlist record was newly created.
    if (inserted) {
      const sessionId = req.headers["x-session-id"] || null;

      void onSaveAdded(postId).catch((err) =>
        console.error("Wishlist add analytics failed:", err)
      );

      void trackEvent({
        user: userId,
        sessionId,
        eventType: "wishlist_add",
        targetType: "post",
        targetId: postId,
        source: "web",
      }).catch((err) =>
        console.error("Wishlist add event tracking failed:", err)
      );

      fireAndForget(() =>
        insertFeedback({
          feedbackType: "save",
          userId,
          postId,
        })
      );
    }

    return res.status(200).json({
      success: true,
      isWishlisted: true,
    });
  } catch (err) {
    // A concurrent upsert can still hit the unique index.
    if (err.code === 11000) {
      return res.status(200).json({
        success: true,
        isWishlisted: true,
      });
    }

    console.error("Wishlist add failed:", err);
    return res.status(500).json({ message: "Server error" });
  }
});


// ── Unsave post ───────────────────────────────────────────────────────────────

router.delete("/", verifyToken, async (req, res) => {
  try {
    const { postId } = req.body;
    const userId = req.user.id;

    if (!mongoose.isValidObjectId(postId)) {
      return res.status(400).json({ message: "Invalid postId" });
    }

    // Delete only if the record exists.
    const deleted = await Wishlist.findOneAndDelete({
      post: postId,
      user: userId,
    });

    // Missing records are already in the desired state.
    if (deleted) {
      const sessionId = req.headers["x-session-id"] || null;

      void onSaveRemoved(postId).catch((err) =>
        console.error("Wishlist removal analytics failed:", err)
      );

      void trackEvent({
        user: userId,
        sessionId,
        eventType: "wishlist_remove",
        targetType: "post",
        targetId: postId,
        source: "web",
      }).catch((err) =>
        console.error("Wishlist removal event tracking failed:", err)
      );

      fireAndForget(() =>
        deleteFeedback({
          feedbackType: "save",
          userId,
          postId,
        })
      );
    }

    return res.status(200).json({
      success: true,
      isWishlisted: false,
    });
  } catch (err) {
    console.error("Wishlist removal failed:", err);
    return res.status(500).json({ message: "Server error" });
  }
});


export default router;