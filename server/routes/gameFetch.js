import express from "express";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../s3.js";
// import verifyToken from "../middlewares/authMiddleware.js";
import GamePost from "../models/GamePost.js";

const router = express.Router();
const bucketName = process.env.AWS_BUCKET_NAME;

// GET all games (with signed cover image URLs)
router.get("/",async (req, res) => {
  try {
    const games = await GamePost.find().populate("createdBy", "username email");

    // Generate signed URLs for cover images
    const gamesWithUrls = await Promise.all(
      games.map(async (game) => {
        let coverImageUrl = null;
        if (game.coverImageKey) {
          coverImageUrl = await getSignedUrl(
            s3,
            new GetObjectCommand({
              Bucket: bucketName,
              Key: game.coverImageKey,
            }),
            { expiresIn: 3600 } // 1 hour validity
          );
        }

        return {
          _id: game._id,
          title: game.title,
          description: game.description,
          isHeavyGame: game.isHeavyGame,
          coverImageUrl,
          createdBy: game.createdBy, // populated user
          createdAt: game.createdAt,
        };
      })
    );

    res.json({ success: true, games: gamesWithUrls });
  } catch (error) {
    console.error("Error fetching games:", error);
    res.status(500).json({ success: false, error: "Failed to fetch games" });
  }
});

export default router;
