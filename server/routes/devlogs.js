import express from "express";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import Devlog from "../models/Devlogs.js";
import s3 from "../s3.js";

const router = express.Router();

const BUCKET = process.env.AWS_DEVLOGS_BUCKET_NAME;

async function signUrlIfNeeded(urlOrKey) {
  if (!urlOrKey) return null;

  // if you stored full https://bucket.s3... URL, extract key
  let key = urlOrKey;
  const idx = urlOrKey.indexOf(".amazonaws.com/");
  if (idx !== -1) {
    key = decodeURIComponent(urlOrKey.split(".com/")[1]);
  }

  try {
    return await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
      { expiresIn: 3600 } // 1h
    );
  } catch (e) {
    console.error("signUrlIfNeeded error", e);
    return urlOrKey; // fallback to raw value
  }
}

// recursively sign any media array or single object
async function signMedia(data) {
  if (!data) return null;

  if (Array.isArray(data)) {
    return Promise.all(
      data.map(async (item) => ({
        ...item,
        url: await signUrlIfNeeded(item.url),
      }))
    );
  }

  if (data.url) {
    return { ...data, url: await signUrlIfNeeded(data.url) };
  }

  return data;
}

// GET signed URL for upload
router.get("/getUploadUrl", async (req, res) => {
  try {
    const { fileName, fileType } = req.query;
    if (!fileName || !fileType) {
      return res.status(400).json({ message: "Missing fileName or fileType" });
    }

    // Create a unique key with timestamp
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = `${timestamp}-${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });
    console.log("uploadUrl", uploadUrl);

    res.status(200).json({ uploadUrl, key });
  } catch (err) {
    console.error("Error creating signed URL:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET a single devlog by ID
router.get("/:id", async (req, res) => {
  try {
    const devlog = await Devlog.findById(req.params.id).lean();
    console.log("devlog", devlog);
    if (!devlog) return res.status(404).json({ message: "Devlog not found" });

    const pd = { ...devlog.pageData };

    // Sign all media URLs
    pd.screenshots = await signMedia(pd.screenshots);
    pd.videos = await signMedia(pd.videos);
    pd.bgImage = await signMedia(pd.bgImage);
    pd.gameTitleImage = await signMedia(pd.gameTitleImage);

    // Sign file URLs
    if (pd.files) {
      pd.files = await Promise.all(
        pd.files.map(async (f) => ({
          ...f,
          url: await signUrlIfNeeded(f.url),
        }))
      );
    }

    // Blog sections don't need signing (they're just text)
    // but ensure they exist
    if (!pd.blogSections) {
      pd.blogSections = [];
    }

    res.json({ devlog: { ...devlog, pageData: pd } });
  } catch (err) {
    console.error("Error fetching devlog:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET all devlogs (optional - for listing)
router.get("/", async (req, res) => {
  try {
    const devlogs = await Devlog.find()
      .sort({ createdAt: -1 })
      .select("pageData.gameTitle pageData.postTitle createdAt")
      .lean();

    res.json({ devlogs });
  } catch (err) {
    console.error("Error fetching devlogs:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST - Create a new devlog
router.post("/", async (req, res) => {
  try {
    const { pageData, leftColumnCards, rightColumnCards, gradientColor } = req.body;

    console.log("Received devlog data:", pageData, leftColumnCards, rightColumnCards, gradientColor);

    // Clean up the file objects - remove the 'file' property before saving
    if (pageData.screenshots) {
      pageData.screenshots = pageData.screenshots.map(({ file, ...rest }) => rest);
    }
    if (pageData.videos) {
      pageData.videos = pageData.videos.map(({ file, ...rest }) => rest);
    }
    if (pageData.files) {
      pageData.files = pageData.files.map(({ file, ...rest }) => rest);
    }
    if (pageData.bgImage?.file) {
      const { file, ...rest } = pageData.bgImage;
      pageData.bgImage = rest;
    }
    if (pageData.gameTitleImage?.file) {
      const { file, ...rest } = pageData.gameTitleImage;
      pageData.gameTitleImage = rest;
    }

    const newDevlog = new Devlog({
      pageData,
      leftColumnCards,
      rightColumnCards,
      gradientColor,
    });

    await newDevlog.save();
    res.status(201).json({ message: "Devlog saved", devlog: newDevlog });
  } catch (err) {
    console.error("Error saving devlog:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// PUT - Update an existing devlog
router.put("/:id", async (req, res) => {
  try {
    const { pageData, leftColumnCards, rightColumnCards, gradientColor } = req.body;

    // Clean up the file objects
    if (pageData.screenshots) {
      pageData.screenshots = pageData.screenshots.map(({ file, ...rest }) => rest);
    }
    if (pageData.videos) {
      pageData.videos = pageData.videos.map(({ file, ...rest }) => rest);
    }
    if (pageData.files) {
      pageData.files = pageData.files.map(({ file, ...rest }) => rest);
    }
    if (pageData.bgImage?.file) {
      const { file, ...rest } = pageData.bgImage;
      pageData.bgImage = rest;
    }
    if (pageData.gameTitleImage?.file) {
      const { file, ...rest } = pageData.gameTitleImage;
      pageData.gameTitleImage = rest;
    }

    const updatedDevlog = await Devlog.findByIdAndUpdate(
      req.params.id,
      {
        pageData,
        leftColumnCards,
        rightColumnCards,
        gradientColor,
      },
      { new: true }
    );

    if (!updatedDevlog) {
      return res.status(404).json({ message: "Devlog not found" });
    }

    res.json({ message: "Devlog updated", devlog: updatedDevlog });
  } catch (err) {
    console.error("Error updating devlog:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// DELETE a devlog
router.delete("/:id", async (req, res) => {
  try {
    const devlog = await Devlog.findByIdAndDelete(req.params.id);

    if (!devlog) {
      return res.status(404).json({ message: "Devlog not found" });
    }

    res.json({ message: "Devlog deleted successfully" });
  } catch (err) {
    console.error("Error deleting devlog:", err);
    res.status(500).json({ message: "Server error" });
  }
});



export default router;