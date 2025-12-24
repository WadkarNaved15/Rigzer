import express from "express";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3 from "../s3.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

router.post("/presigned-url", async (req, res) => {
  try {
    console.log("Presigned URL request received");
    const { fileName, fileType } = req.body;

    if (!fileName) {
      return res.status(400).json({ message: "File name required" });
    }

    const key = `models/raw/${uuidv4()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ContentType: fileType || "model/gltf-binary",
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 300, // 5 minute
    });

    res.json({
      uploadUrl,
      key,
      // CloudFront URL used later for viewing
      fileUrl: `${process.env.CLOUDFRONT_DOMAIN}/${key}`,
    });

  } catch (err) {
    console.error("Presigned URL error:", err);
    res.status(500).json({ message: "Failed to generate upload URL" });
  }
});

export default router;
