import mongoose from "mongoose";
import Article from "../models/Canvas.js";
import redis from "../config/redis.js";
/**
 * GET /api/articles/:id
 */
export const getPublishedArticleById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid article ID" });
    }

    const article = await Article.findOne({
      _id: id,
      status: "published",
    }).lean();

    if (!article) {
      return res.status(404).json({
        message: "Article not found or not published",
      });
    }

    res.status(200).json(article);
  } catch (error) {
    console.error("Error fetching article:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * GET /api/articles/published
 */
export const getPublishedArticles = async (req, res) => {
  try {

    const cacheKey = "billboard_articles";

    // 1️⃣ Check Redis first
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }

    // 2️⃣ If not cached → query Mongo
    const articles = await Article.find(
      { status: "published" },
      {
        title: 1,
        subtitle: 1,
        hero_image_url: 1,
        author_name: 1,
        publishedAt: 1,
      }
    )
      .sort({ publishedAt: -1 })
      .limit(12)
      .lean();

    // 3️⃣ Store in Redis
    await redis.set(
      cacheKey,
      JSON.stringify(articles),
      "EX",
      300
    );

    res.status(200).json(articles);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch articles" });
  }
};

/**
 * GET /api/articles/published/user/:userId
 * Return only published articles owned by a specific user
 */
export const getUserPublishedArticles = async (req, res) => {
  try {
    const { userId } = req.params;

    // ✅ Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const articles = await Article.find(
      {
        status: "published",
        ownerId: userId,
      },
      {
        title: 1,
        subtitle: 1,
        hero_image_url: 1,
        author_name: 1,
        publishedAt: 1,
      }
    )
      .sort({ publishedAt: -1 })
      .limit(12)
      .lean();

    res.status(200).json(articles);
  } catch (error) {
    console.error("Error fetching user published articles:", error);
    res.status(500).json({ message: "Failed to fetch user articles" });
  }
};

