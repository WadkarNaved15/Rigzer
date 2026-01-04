import express from "express";
import Canvas from "../models/Canvas.js"; 
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/publish", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Basic validation
    if (!req.body.title || !req.body.content?.length) {
      return res.status(400).json({
        message: "Title and at least one canvas element are required"
      });
    }

    const canvas = new Canvas({
      ...req.body,
      ownerId: userId,
      status: "published",
      publishedAt: new Date()
    });

    await canvas.save();

    res.status(201).json(canvas);
  } catch (error) {
    console.error("Error publishing canvas:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
