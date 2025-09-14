import express from "express";
import { uploadGameFiles } from "../middlewares/upload.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../s3.js";

const router = express.Router();
const bucketName = process.env.AWS_BUCKET_NAME;

router.post("/", uploadGameFiles, async (req, res) => {
    try {
        const gameZipKey = req.files["gameZip"]?.[0]?.key;
        const coverImageKey = req.files["coverImage"]?.[0]?.key;

        // Generate signed URL for cover image (valid 1 hour)
        let coverImageUrl = null;
        if (coverImageKey) {
            coverImageUrl = await getSignedUrl(
                s3,
                new GetObjectCommand({
                    Bucket: bucketName,
                    Key: coverImageKey,
                }),
                { expiresIn: 3600 } // 1 hour
            );
        }
        // (optional) signed URL for zip too, if you need temporary access
        // const gameZipUrl = await getSignedUrl(
        //   s3,
        //   new GetObjectCommand({
        //     Bucket: bucketName,
        //     Key: gameZipKey,
        //   }),
        //   { expiresIn: 3600 }
        // );
        res.json({
            success: true,
            gameZipKey: gameZipKey,   // only the key, don’t expose file directly
            coverImageUrl: coverImageUrl, // safe to show in frontend <img>
        });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ success: false, error: "Upload failed" });
    }
});

export default router;
