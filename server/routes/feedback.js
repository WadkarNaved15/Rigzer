// routes/feedback.js
import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import { insertFeedback, fireAndForget } from "../services/gorse.client.js";

const router = express.Router();

router.post("/share", authMiddleware, async (req, res) => {
  const { postId } = req.body;
  const userId = req.user.id;

  // fire and forget (non-blocking)
  fireAndForget(() =>
    insertFeedback({
      feedbackType: "share",
      userId,
      postId,
    })
  );

  res.json({ success: true });
});
// routes/feedback.js

router.post("/view", authMiddleware, async (req, res) => {
  try {
    const { postId} = req.body;
    const userId = req.user.id;

    // 🔥 validate
    if (!postId) {
      return res.status(400).json({ error: "postId required" });
    }

    // 🔥 async push (non-blocking)
    fireAndForget(() =>
      insertFeedback({
        feedbackType: "read", // 🔥 IMPORTANT for Gorse
        userId,
        postId,
      })
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("View tracking error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

export default router;