import mongoose from "mongoose";
import Article from "../models/Canvas.js";

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
      .lean();

    res.status(200).json(articles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch articles" });
  }
};
