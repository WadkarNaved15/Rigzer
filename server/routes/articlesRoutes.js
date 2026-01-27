import express from "express";
import Article from "../models/Canvas.js";
import AllPost from "../models/Allposts.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import {
  getPublishedArticleById,
  getPublishedArticles,
} from "../controllers/canvas.controller.js";

const router = express.Router();

/**
 * Public feed listing
 */
router.get("/published", getPublishedArticles);

/**
 * Public article read
 */
router.get("/:id", getPublishedArticleById);

/**
 * Publish article
 */
router.post("/publish", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, description, content, headerImage ,author_name} = req.body;

    if (!title || !content) {
      return res.status(400).json({
        message: "Title and article content are required",
      });
    }

    // 1️⃣ Save Article (HEAVY)
    const article = await Article.create({
      ownerId: userId,
      title,
      subtitle: description,
      author_name: author_name,
      hero_image_url: headerImage,
      content,
      status: "published",
      publishedAt: new Date(),
    });

    // 2️⃣ Create Feed Post (LIGHT)
    const post = await AllPost.create({
      user: userId,
      type: "canvas_article",
      description: description || title,
      canvasRef: canvas._id,
    });

    res.status(201).json({
      article,
      postId: post._id,
    });
  } catch (error) {
    console.error("Error publishing article:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
