import express from "express";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3 from "../s3.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

router.post("/presigned-url", async (req, res) => {
  try {
    const { fileName, fileType, category } = req.body;

    if (!fileName) {
      return res.status(400).json({ message: "File name required" });
    }

    let baseDir = "misc";

    if (category === "image") {
      baseDir = "media/images";
    } 
    else if (category === "video") {
      baseDir = "media/videos";
    } 
    else if (
      fileType === "model/gltf-binary" ||
      fileName.toLowerCase().endsWith(".glb")
    ) {
      baseDir = "models/raw";
    }

    const key = `${baseDir}/${uuidv4()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ContentType: fileType || "application/octet-stream",
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 300, // 5 min
    });

    res.json({
      uploadUrl,
      key,
      fileUrl: `${process.env.CLOUDFRONT_DOMAIN}/${key}`,
    });
  } catch (err) {
    console.error("Presigned URL error:", err);
    res.status(500).json({ message: "Failed to generate upload URL" });
  }
});


export default router;
