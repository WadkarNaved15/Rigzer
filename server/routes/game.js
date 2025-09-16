import express from "express";
import { uploadGameFiles } from "../middlewares/upload.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../s3.js";
import verifyToken from "../middlewares/authMiddleware.js"; // your auth middleware
import GamePost from "../models/GamePost.js"; // mongoose model

const router = express.Router();
const bucketName = process.env.AWS_BUCKET_NAME;

// POST - upload game
router.post("/", verifyToken, uploadGameFiles, async (req, res) => {
  try {
    const { title, description, isHeavyGame } = req.body;
    const gameZipKey = req.files["gameZip"]?.[0]?.key;
    const coverImageKey = req.files["coverImage"]?.[0]?.key;

    if (!gameZipKey || !coverImageKey) {
      return res.status(400).json({ success: false, error: "Files missing" });
    }

    // Generate signed URL for cover image (1 hour validity)
    const coverImageUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: bucketName,
        Key: coverImageKey,
      }),
      { expiresIn: 3600 }
    );

    // Save post in MongoDB with userId
    const newPost = new GamePost({
      title,
      description,
      isHeavyGame: isHeavyGame === "true", // since formData sends strings
      gameZipKey,
      coverImageKey,
      createdBy: req.user.id, // 👈 userId from JWT
    });

    await newPost.save();

    res.json({
      success: true,
      post: {
        _id: newPost._id,
        title: newPost.title,
        description: newPost.description,
        isHeavyGame: newPost.isHeavyGame,
        gameZipKey: newPost.gameZipKey,
        coverImageUrl, // signed URL for frontend display
        createdBy: newPost.createdBy,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ success: false, error: "Upload failed" });
  }
});

export default router;
