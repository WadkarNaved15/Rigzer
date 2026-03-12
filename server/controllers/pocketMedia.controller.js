// controllers/pocketMedia.controller.js
//
// Handles media uploads for Pocket creators.
// Files are stored under pockets/<pocketId>/media/<uuid>.<ext>
// and returned as CDN URLs the creator can paste directly into their JSX.
//
// Supported types: images (jpg, png, gif, webp, svg) and video (mp4, webm)
// Max size: 20 MB per file, 20 files total per pocket.

import crypto          from "crypto";
import path            from "path";
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import Pocket          from "../models/Pocket.js";

const s3       = new S3Client({ region: process.env.AWS_REGION });
const BUCKET   = process.env.AWS_BUCKET_NAME;
const CDN_BASE = process.env.GAMES_STORAGE_PRIVATE_CLOUDFRONT;

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "video/mp4",  "video/webm",
]);
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_FILES      = 20;

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/pockets/media/upload
   multipart/form-data: files (1-10)
   Uses multer (memory storage) — wire up in routes file.
───────────────────────────────────────────────────────────────────────────── */
export const uploadPocketMedia = async (req, res) => {
  try {
    const pocket = await Pocket.findOne({ owner: req.user.id }, "_id status").lean();
    if (!pocket) return res.status(404).json({ message: "Save a draft pocket first." });
    if (pocket.status === "pending_review") {
      return res.status(400).json({ message: "Cannot upload media while pocket is under review." });
    }
 
    const files = req.files;   // multer.array() → always an array
    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No files received." });
    }
 
    // Check existing count so we don't exceed the cap
    const listRes = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: `pockets/${pocket._id}/media/`,
    }));
    const existingCount = listRes.KeyCount ?? 0;
    if (existingCount + files.length > MAX_FILES) {
      return res.status(400).json({
        message: `Upload would exceed the ${MAX_FILES}-file limit. You currently have ${existingCount}.`,
      });
    }
 
    const results = [];
    const errors  = [];
 
    await Promise.all(files.map(async (file) => {
      // Per-file validation
      if (!ALLOWED_MIME.has(file.mimetype)) {
        errors.push({ name: file.originalname, error: "Unsupported type. Allowed: jpg, png, gif, webp, svg, mp4, webm." });
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        errors.push({ name: file.originalname, error: "Exceeds 20 MB limit." });
        return;
      }
 
      const ext   = path.extname(file.originalname).toLowerCase() || mimeToExt(file.mimetype);
      const uuid  = crypto.randomUUID();
      const s3Key = `pockets/${pocket._id}/media/${uuid}${ext}`;
 
      await s3.send(new PutObjectCommand({
        Bucket:       BUCKET,
        Key:          s3Key,
        Body:         file.buffer,
        ContentType:  file.mimetype,
        CacheControl: "public, max-age=31536000, immutable",
      }));
 
      results.push({
        url:    `${CDN_BASE}/${s3Key}`,
        s3Key,
        name:   file.originalname,
        sizeMB: +(file.size / 1024 / 1024).toFixed(2),
        type:   file.mimetype.startsWith("video/") ? "video" : "image",
      });
    }));
 
    return res.status(200).json({ uploaded: results, errors });
  } catch (err) {
    console.error("uploadPocketMedia:", err);
    return res.status(500).json({ message: "Upload failed" });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   DELETE /api/pockets/media
   Body: { s3Key: "pockets/<id>/media/<uuid>.ext" }
───────────────────────────────────────────────────────────────────────────── */
export const deletePocketMedia = async (req, res) => {
  try {
    const { s3Key } = req.body;
    if (!s3Key) return res.status(400).json({ message: "s3Key is required" });

    // Security: key must belong to the requesting user's pocket
    const pocket = await Pocket.findOne({ owner: req.user.id }, "_id").lean();
    if (!pocket) return res.status(404).json({ message: "Pocket not found" });

    const expectedPrefix = `pockets/${pocket._id}/media/`;
    if (!s3Key.startsWith(expectedPrefix)) {
      return res.status(403).json({ message: "Cannot delete media from another pocket." });
    }

    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key }));
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("deletePocketMedia:", err);
    return res.status(500).json({ message: "Delete failed" });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   GET /api/pockets/media
   Lists all media files already uploaded for the caller's pocket.
   Called on editor mount to restore the media panel.
───────────────────────────────────────────────────────────────────────────── */
export const listPocketMedia = async (req, res) => {
  try {
    const pocket = await Pocket.findOne({ owner: req.user.id }, "_id").lean();
    if (!pocket) return res.status(200).json({ files: [] });

    const listRes = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: `pockets/${pocket._id}/media/`,
    }));

    const files = (listRes.Contents ?? []).map((obj) => {
      const url  = `${CDN_BASE}/${obj.Key}`;
      const ext  = path.extname(obj.Key).toLowerCase();
      const type = [".mp4", ".webm"].includes(ext) ? "video" : "image";
      return {
        s3Key:  obj.Key,
        url,
        sizeMB: +(obj.Size / 1024 / 1024).toFixed(2),
        type,
        name:   obj.Key.split("/").pop(),
      };
    });

    return res.status(200).json({ files });
  } catch (err) {
    console.error("listPocketMedia:", err);
    return res.status(500).json({ message: "Failed to list media" });
  }
};

// ── helpers ──────────────────────────────────────────────────────────────────
function mimeToExt(mime) {
  const map = {
    "image/jpeg":    ".jpg",
    "image/png":     ".png",
    "image/gif":     ".gif",
    "image/webp":    ".webp",
    "image/svg+xml": ".svg",
    "video/mp4":     ".mp4",
    "video/webm":    ".webm",
  };
  return map[mime] ?? ".bin";
}