import express from "express";
import {
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  DeleteObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3 from "../s3.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

const MAX_MODEL_SIZE_MB = 150;
const MAX_MODEL_SIZE_BYTES = MAX_MODEL_SIZE_MB * 1024 * 1024;

router.post("/presigned-url", async (req, res) => {
  try {
    const { fileName, fileType, category, fileSize } = req.body;

    if (!fileName || !category) {
      return res.status(400).json({ message: "fileName and category required" });
    }

    if (fileType?.startsWith("image/") && fileSize > 5 * 1024 * 1024) {
      return res.status(400).json({ message: "Image too large" });
    }

    if (fileType?.startsWith("video/") && fileSize > 50 * 1024 * 1024) {
      return res.status(400).json({ message: "Video too large" });
    }
    
    if (fileSize > MAX_MODEL_SIZE_BYTES) {
      return res.status(400).json({ message: "File size exceeds the limit" });
    }

    let key;

    if (category === "original") {
      key = `models/original/${uuidv4()}-${fileName}`;
    }

    else if (category === "media") {
      if (fileType?.startsWith("image/")) {
        key = `media/images/${uuidv4()}-${fileName}`;
      } else if (fileType?.startsWith("video/")) {
        key = `media/videos/${uuidv4()}-${fileName}`;
      } else {
        return res.status(400).json({ message: "Unsupported file type" });
      }
    }

    else if (category === "background") {
      key = `models/background/${uuidv4()}-${fileName}`;
    }

    else {
      return res.status(400).json({ message: "Invalid upload category" });
    }

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ContentType: fileType || "application/octet-stream",
      StorageClass: "INTELLIGENT_TIERING",
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 300,
    });
    res.json({
      uploadUrl,
      key,
      fileUrl: `${process.env.GAMES_STORAGE_PRIVATE_CLOUDFRONT}/${key}`,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed" });
  }
});


router.post("/game/start-multipart", async (req, res) => {
  try {
    const { fileName, fileType } = req.body;
    const key = `games/builds/${uuidv4()}-${fileName}`;

    const command = new CreateMultipartUploadCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ContentType: fileType || "application/octet-stream",
    });

    const response = await s3.send(command);
    res.json({ uploadId: response.UploadId, key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Multipart start failed" });
  }
});

// 2. Get a presigned URL for a specific part
router.post("/game/get-part-url", async (req, res) => {
  try {
    const { fileName, uploadId, partNumber, key } = req.body;

    const command = new UploadPartCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
    res.json({ uploadUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Part signing failed" });
  }
});

// 3. Complete the multipart upload
router.post("/game/complete-multipart", async (req, res) => {
  try {
    const { uploadId, key, parts } = req.body; // parts: [{ ETag, PartNumber }, ...]

    const command = new CompleteMultipartUploadCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        // AWS requires parts to be sorted by PartNumber
        Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
      },
    });

    await s3.send(command);
    res.json({
      success: true,
      fileUrl: `/${key}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Completion failed" });
  }
});


router.post("/cleanup", async (req, res) => {
  try {
    const { keys } = req.body;

    for (const key of keys) {
      // delete original
      await s3.send(new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
      }));

      // delete optimized
      const optimizedKey = key.replace(
        "models/original/",
        "models/optimized/"
      );

      await s3.send(new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: optimizedKey,
      }));
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Cleanup failed:", err);
    res.status(500).json({ message: "Cleanup failed" });
  }
});

export default router;
