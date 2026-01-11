import express from "express";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import AllPost from "../models/Allposts.js";
import CanvasScene from "../models/DevlogCanvas.js";
import s3 from "../s3.js";

const router = express.Router();

const BUCKET = process.env.AWS_DEVLOGS_CANVAS_BUCKET_NAME;
const CLOUD_FRONT = process.env.AWS_DEVLOGS_CANVAS_CLOUDFRONT;

function resolveCloudFrontUrl(keyOrUrl) {
  if (!keyOrUrl) return null;

  const value = keyOrUrl.trim();

  // If it's already a valid absolute URL, return it CLEAN
  try {
    const url = new URL(value);
    return url.href;
  } catch {
    // Not a URL → continue
  }

  // Ensure we NEVER double-prefix
  return `${CLOUD_FRONT}/${value.replace(/^\/+/, "")}`;
}

function normalizeKey(value) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return decodeURIComponent(url.pathname.slice(1));
  } catch {
    return value.replace(/^\/+/, "");
  }
}



function extractS3Key(urlOrKey) {
  if (!urlOrKey) return null;

  if (urlOrKey.startsWith("http")) {
    const u = new URL(urlOrKey);
    return decodeURIComponent(u.pathname.slice(1));
  }

  return urlOrKey;
}

function stripCloudFront(urlOrKey) {
  if (!urlOrKey) return urlOrKey;

  if (urlOrKey.startsWith("http")) {
    const u = new URL(urlOrKey);
    return decodeURIComponent(u.pathname.slice(1));
  }

  return urlOrKey;
}



// Helper: Sign all media URLs in canvas objects
async function signCanvasObjects(objects) {
  return objects.map(obj => {
    const resolved = { ...obj };

    if (obj.source) {
      resolved.source = resolveCloudFrontUrl(obj.source);
    }

    if (obj.spritesheet) {
      resolved.spritesheet = {
        ...obj.spritesheet,
        jsonUrl: resolveCloudFrontUrl(obj.spritesheet.jsonUrl),
        imageUrl: resolveCloudFrontUrl(obj.spritesheet.imageUrl)
      };
    }

    return resolved;
  });
}


// GET signed URL for upload
router.get("/getUploadUrl", async (req, res) => {
  try {
    const { fileName, fileType, objectType } = req.query;

    if (!fileName || !fileType) {
      return res.status(400).json({ message: "Missing fileName or fileType" });
    }

    // Create a unique key with timestamp and object type folder
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const folder = objectType || 'misc';
    const key = `${folder}/${timestamp}-${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });

    res.status(200).json({ uploadUrl, key });
  } catch (err) {
    console.error("Error creating signed URL:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST - Create a new canvas scene
router.post("/", async (req, res) => {
  try {
    const { userId, title, description, objects, cameraX, cameraY, cameraZoom, isPublic, tags } = req.body;

    console.log("Creating canvas scene for user:", userId, req.body);

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    // Create new scene
    const newScene = new CanvasScene({
      userId,
      title: title || 'Untitled Canvas',
      description: description || '',
      objects: objects || [],
      cameraX: cameraX || 0,
      cameraY: cameraY || 0,
      cameraZoom: cameraZoom || 1,
      isPublic: isPublic || false,
      tags: tags || []
    });

    await newScene.save();

    res.status(201).json({
      message: "Canvas scene created successfully",
      scene: newScene
    });
  } catch (err) {
    console.error("Error creating canvas scene:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.post("/upload", async (req, res) => {
  try {
    const { userId, objects, cameraX, cameraY, cameraZoom } = req.body;
    console.log("Canvas upload request:", req.body);

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const scene = new CanvasScene({
      userId,
      objects: objects || [],
      cameraX: cameraX ?? 0,
      cameraY: cameraY ?? 0,
      cameraZoom: cameraZoom ?? 1,
      isPublic: false,
      isComplete: false
    });

    await scene.save();

    res.status(201).json({
      message: "Canvas uploaded",
      sceneId: scene._id
    });
  } catch (err) {
    console.error("Canvas upload error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


router.patch("/:id/meta", async (req, res) => {
  try {
    const { userId, title, description, tags, isPublic } = req.body;

    const scene = await CanvasScene.findById(req.params.id);
    if (!scene) {
      return res.status(404).json({ message: "Scene not found" });
    }

    if (scene.userId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (title !== undefined) scene.title = title;
    if (description !== undefined) scene.description = description;
    if (tags !== undefined) scene.tags = tags;
    if (isPublic !== undefined) scene.isPublic = isPublic;

    await scene.save();

    res.json({
      message: "Metadata saved"
    });
  } catch (err) {
    console.error("Meta update error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id/publish", async (req, res) => {
  try {
    const { userId, thumbnailKey } = req.body;

    const scene = await CanvasScene.findById(req.params.id);
    if (!scene) {
      return res.status(404).json({ message: "Scene not found" });
    }

    if (scene.userId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (!thumbnailKey) {
      return res.status(400).json({ message: "thumbnailKey required" });
    }

    scene.thumbnail = thumbnailKey;
    scene.isComplete = true;
    scene.isPublic = true;

    await scene.save();

    const post = await AllPost.create({
      user: userId,
      description: scene.description || scene.title,
      type: "devlog_post",
      devlogRef: scene._id,

      // snapshot for feed
      devlogMeta: {
        title: scene.title,
        thumbnail: resolveCloudFrontUrl(thumbnailKey),
      }
    });


    res.json({
      message: "Scene published",
      sceneId: scene._id,
      thumbnail: resolveCloudFrontUrl(thumbnailKey)
    });
  } catch (err) {
    console.error("Publish error:", err);
    res.status(500).json({ message: "Server error" });
  }
});



// GET - Get all canvas scenes for a user
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, search, tags } = req.query;

    const query = { userId };

    // Search filter
    if (search) {
      query.$text = { $search: search };
    }

    // Tags filter
    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim());
      query.tags = { $in: tagArray };
    }

    const scenes = await CanvasScene.find(query)
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select('title description thumbnail updatedAt createdAt tags objects')
      .lean();

    // Sign thumbnail URLs
    const scenesWithSignedUrls = await Promise.all(
      scenes.map(async (scene) => ({
        ...scene,
        thumbnail: resolveCloudFrontUrl(scene.thumbnail),
        objectCount: scene.objects?.length || 0
      }))
    );

    const total = await CanvasScene.countDocuments(query);

    res.json({
      scenes: scenesWithSignedUrls,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error("Error fetching canvas scenes:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET - Get public canvas scenes (gallery/explore)
router.get("/public", async (req, res) => {
  try {
    const { page = 1, limit = 20, search, tags } = req.query;

    const query = { isPublic: true };

    if (search) {
      query.$text = { $search: search };
    }

    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim());
      query.tags = { $in: tagArray };
    }

    const scenes = await CanvasScene.find(query)
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select('title description thumbnail updatedAt createdAt tags userId objects')
      .lean();

    const scenesWithSignedUrls = await Promise.all(
      scenes.map(async (scene) => ({
        ...scene,
        thumbnail: resolveCloudFrontUrl(scene.thumbnail),
        objectCount: scene.objects?.length || 0
      }))
    );

    const total = await CanvasScene.countDocuments(query);

    res.json({
      scenes: scenesWithSignedUrls,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error("Error fetching public scenes:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET - Get a single canvas scene by ID
router.get("/:id", async (req, res) => {
  try {
    console.log("Fetching canvas scene ID:", req.params.id);
    const scene = await CanvasScene.findById(req.params.id).lean();

    if (!scene) {
      return res.status(404).json({ message: "Canvas scene not found" });
    }


    // Sign all media URLs in objects
    scene.objects = await signCanvasObjects(scene.objects);
    console.log("After signCanvas", scene)
    scene.thumbnail = resolveCloudFrontUrl(scene.thumbnail);
    console.log("After resolveCloudFront", scene)

    res.json({ scene });

  } catch (err) {
    console.error("Error fetching canvas scene:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT - Update a canvas scene
// PUT - Update a canvas scene
router.put("/:id", async (req, res) => {
  try {
    const {
      userId,
      title,
      description,
      objects,
      cameraX,
      cameraY,
      cameraZoom,
      thumbnail,
      isPublic,
      tags
    } = req.body;

    const scene = await CanvasScene.findById(req.params.id);

    if (!scene) {
      return res.status(404).json({ message: "Canvas scene not found" });
    }

    // Authorization check
    if (scene.userId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Basic fields
    if (title !== undefined) scene.title = title;
    if (description !== undefined) scene.description = description;
    if (cameraX !== undefined) scene.cameraX = cameraX;
    if (cameraY !== undefined) scene.cameraY = cameraY;
    if (cameraZoom !== undefined) scene.cameraZoom = cameraZoom;
    if (isPublic !== undefined) scene.isPublic = isPublic;
    if (tags !== undefined) scene.tags = tags;

    // 🔑 IMPORTANT: Normalize objects → STORE S3 KEYS ONLY
    if (objects !== undefined) {
      scene.objects = objects.map(obj => ({
        ...obj,
        source: normalizeKey(obj.source),
        spritesheet: obj.spritesheet && {
          ...obj.spritesheet,
          jsonUrl: stripCloudFront(obj.spritesheet.jsonUrl),
          imageUrl: stripCloudFront(obj.spritesheet.imageUrl)
        }
      }));
    }

    // Thumbnail → store KEY only
    if (thumbnail !== undefined) {
      scene.thumbnail = stripCloudFront(thumbnail);
    }

    await scene.save();

    // Return CloudFront URLs back to client
    const savedScene = scene.toObject();
    savedScene.objects = await signCanvasObjects(savedScene.objects);
    savedScene.thumbnail = resolveCloudFrontUrl(savedScene.thumbnail);

    res.json({
      message: "Canvas scene updated successfully",
      scene: savedScene
    });
  } catch (err) {
    console.error("Error updating canvas scene:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


// DELETE - Delete a canvas scene
router.delete("/:id", async (req, res) => {
  try {
    const { userId } = req.query;

    const scene = await CanvasScene.findById(req.params.id);

    if (!scene) {
      return res.status(404).json({ message: "Canvas scene not found" });
    }

    // Basic authorization check
    if (scene.userId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const keysToDelete = [];

    scene.objects.forEach(obj => {
      if (obj.source) keysToDelete.push(extractS3Key(obj.source));
      if (obj.spritesheet?.jsonUrl) keysToDelete.push(extractS3Key(obj.spritesheet.jsonUrl));
      if (obj.spritesheet?.imageUrl) keysToDelete.push(extractS3Key(obj.spritesheet.imageUrl));
    });

    if (scene.thumbnail) keysToDelete.push(extractS3Key(scene.thumbnail));


    // Delete from S3 (optional, you might want to keep them)
    for (const key of keysToDelete) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
      } catch (e) {
        console.error(`Failed to delete S3 object ${key}:`, e);
      }
    }

    await CanvasScene.findByIdAndDelete(req.params.id);

    res.json({ message: "Canvas scene deleted successfully" });
  } catch (err) {
    console.error("Error deleting canvas scene:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST - Duplicate a canvas scene
router.post("/:id/duplicate", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const originalScene = await CanvasScene.findById(req.params.id).lean();

    if (!originalScene) {
      return res.status(404).json({ message: "Canvas scene not found" });
    }

    // Create duplicate
    const duplicateScene = new CanvasScene({
      ...originalScene,
      _id: undefined,
      userId,
      title: `${originalScene.title} (Copy)`,
      createdAt: undefined,
      updatedAt: undefined
    });

    await duplicateScene.save();

    res.status(201).json({
      message: "Canvas scene duplicated successfully",
      scene: duplicateScene
    });
  } catch (err) {
    console.error("Error duplicating canvas scene:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH - Update scene thumbnail
router.patch("/:id/thumbnail", async (req, res) => {
  try {
    const { userId, thumbnailKey } = req.body;

    const scene = await CanvasScene.findById(req.params.id);

    if (!scene) {
      return res.status(404).json({ message: "Canvas scene not found" });
    }

    if (scene.userId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    scene.thumbnail = thumbnailKey;
    await scene.save();

    res.json({
      message: "Thumbnail updated successfully",
      thumbnail: resolveCloudFrontUrl(thumbnailKey)
    });
  } catch (err) {
    console.error("Error updating thumbnail:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;

