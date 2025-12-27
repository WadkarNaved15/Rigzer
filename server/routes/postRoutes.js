import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cloudinary from "../cloudinaryConfig.js";
import { MeiliSearch } from "meilisearch";
import Post from "../models/Allposts.js";
import User from "../models/User.js";  // adjust path
import authMiddleware from "../middlewares/authMiddleware.js";

dotenv.config();

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });
const client = new MeiliSearch({
  host: "http://127.0.0.1:7700",
  apiKey: "shahin124", // your master key
});

const postsIndex = client.index("posts");


// POST /api/posts - Create a new post
router.post("/create_posts", authMiddleware, upload.array("media", 5), async (req, res) => {
  try {
    const { description } = req.body;
    const userId = req.user.id;
    const files = req.files;

    if (!description || !files || files.length === 0) {
      return res.status(400).json({ error: "Description and at least one media file are required" });
    }

    const mediaUrls = [];

    // Upload each file to Cloudinary
    for (const file of files) {
      const uploadOptions = {
        folder: "game_social_posts",
        resource_type: file.mimetype.startsWith("video/") ? "video" : "image", // Detect file type
      };

      const uploadPromise = new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            return reject(error); // Reject the promise instead of sending response
          }
          mediaUrls.push(result.secure_url);
          resolve();
        });
        uploadStream.end(file.buffer);
      });

      await uploadPromise; // Wait for each file upload to complete
    }

    // Save post details in MongoDB
    const newPost = new Post({
      user: userId,
      description,
      type: "normal_post",
      media: mediaUrls,
    });

    await newPost.save(); // Save to database
    res.status(201).json({ message: "Post created successfully", post: newPost });

  } catch (error) {
    console.error("Post creation error:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});
// GET /api/posts - Fetch all posts with user details
// GET /api/posts - Fetch all posts with user details
router.get("/fetch_posts", async (req, res) => {
  try {
    const { cursor, limit = 10 } = req.query;

    const query = cursor ? { _id: { $lt: cursor } } : {};

    const posts = await Post.find(query)
      .populate("user", "username")
      .sort({ _id: -1 })
      .limit(Number(limit))
      .lean(); // 🔥 IMPORTANT for performance

    const nextCursor =
      posts.length > 0 ? posts[posts.length - 1]._id : null;

    res.status(200).json({ posts, nextCursor });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

router.get("/filter_posts", async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({ message: "Search query is required" });
    }

    // 🔍 Search in Meilisearch instead of MongoDB
    const searchResults = await postsIndex.search(query, {
      limit: 50, // max results
      sort: ["createdAt:desc"], // sort newest first
    });

    res.status(200).json({ posts: searchResults.hits });
  } catch (error) {
    console.error("Error filtering posts with Meilisearch:", error);
    res.status(500).json({ message: "Server error" });
  }
});
// routes/posts.js
// routes/posts.js
router.get("/user_posts/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const posts = await Post.find({ user: userId })
      .populate("user", "username")
      .sort({ _id: -1 })
      .lean();

    res.status(200).json({ posts });
  } catch (err) {
    console.error("Error fetching user posts:", err);
    res.status(500).json({ error: "Failed to fetch user posts" });
  }
});



export default router;
