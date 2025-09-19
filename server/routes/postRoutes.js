import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import cloudinary from "../cloudinaryConfig.js";
import Post from "../models/Post.js";
import authMiddleware from "../middlewares/authMiddleware.js";

dotenv.config();

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

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
router.get("/fetch_posts", async (req, res) => {
  try {
    const { cursor, limit = 10 } = req.query;

    const query = cursor
      ? { _id: { $lt: cursor } } // Get older posts than the given _id
      : {};                      // No cursor = first page

    const posts = await Post.find(query)
      .populate("user", "username email")
      .sort({ _id: -1 }) // Sort newest first
      .limit(parseInt(limit));

      console.log("post length ",posts.length)

    const nextCursor = posts.length > 0 ? posts[posts.length - 1]._id : null;

    res.status(200).json({ posts, nextCursor });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});


export default router;
