import express from "express";
import { 
  PutObjectCommand,
  CreateMultipartUploadCommand, 
  UploadPartCommand, 
  CompleteMultipartUploadCommand 
} from "@aws-sdk/client-s3";
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
      fileUrl: `${process.env.CLOUDFRONT_DOMAIN}/${key}` 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Completion failed" });
  }
});


export default router;
