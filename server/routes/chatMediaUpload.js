import express from "express";
import multer from "multer";
import cloudinary from "../cloudinaryConfig.js";
import verifyToken from "../middlewares/authMiddleware.js";

const router = express.Router();

// Multer for temporary upload
const storage = multer.diskStorage({});
const upload = multer({ storage });

router.post("/", verifyToken, upload.single("media"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const folderName = "chat_media";

    const uploaded = await cloudinary.uploader.upload(req.file.path, {
      folder: folderName,
      resource_type: "auto", // auto detect image/video
    });

    let mediaType =
      uploaded.resource_type === "image" ? "image" :
      uploaded.resource_type === "video" ? "video" :
      null;

    res.status(200).json({
      url: uploaded.secure_url,
      mediaType,
    });
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    res.status(500).json({ message: "Upload failed" });
  }
});

export default router;
