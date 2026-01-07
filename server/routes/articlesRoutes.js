import express from "express";
import Canvas from "../models/Canvas.js"; 
import AllPost from "../models/Allposts.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import { getPublishedCanvasById , getPublishedCanvases} from "../controllers/canvas.controller.js";
const router = express.Router();
router.get("/published", getPublishedCanvases);
router.get("/:id", getPublishedCanvasById);
router.post("/publish", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.body.title || !req.body.content?.length) {
      return res.status(400).json({
        message: "Title and at least one canvas element are required",
      });
    }

    // 1️⃣ Save Canvas
    const canvas = await Canvas.create({
      ...req.body,
      ownerId: userId,
      status: "published",
      publishedAt: new Date(),
    });

    // 2️⃣ Create Feed Post (LIGHT)
    const post = await AllPost.create({
      user: userId,
      type: "canvas_article",
      description: canvas.subtitle || canvas.title,
      canvasRef: canvas._id,
    });

    res.status(201).json({
      canvas,
      postId: post._id,
    });
  } catch (error) {
    console.error("Error publishing canvas:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
