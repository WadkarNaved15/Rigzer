import AllPost from "../models/Allposts.js";
import { extractMetadataFromUrl } from "../services/modelMetaData.service.js";

export const createPost = async (req, res) => {
  console.log("Create post controller got hit");

  try {
    const { type } = req.body;
    console.log("Post type:", type);

    if (!type) {
      return res.status(400).json({ message: "Post type is required" });
    }

    /* ======================================================
       NORMAL POST
    ====================================================== */
    if (type === "normal_post") {
      const { description, assets } = req.body;

      if (!description) {
        return res.status(400).json({ message: "Description required" });
      }

      if (!assets || assets.length === 0 || assets.length > 4) {
        return res.status(400).json({
          message: "Normal post must have 1–4 media assets",
        });
      }

      const post = await AllPost.create({
        user: req.user.id,
        description,
        type: "normal_post",
        normalPost: {
          assets: assets.map((asset) => ({
            name: asset.name,
            url: asset.url,
            type: asset.type, // image | video
          })),
        },
      });

      return res.status(201).json({
        message: "Media post created successfully",
        post,
      });
    }

    /* ======================================================
       MODEL POST
    ====================================================== */
    if (type === "model_post") {
      const { title, description, price, assets } = req.body;

      if (!title || price === undefined) {
        return res.status(400).json({
          message: "Model post requires title and price",
        });
      }

      if (!assets || assets.length === 0 || assets.length > 4) {
        return res.status(400).json({
          message: "Model post must have 1–4 assets",
        });
      }

      const processedAssets = [];

      for (const asset of assets) {
        const metadata = await extractMetadataFromUrl(asset.url);

        processedAssets.push({
          name: asset.name,
          url: asset.url,
          sizeMB: Number(metadata.fileSizeMB),
          metadata: {
            fileName: metadata.fileName,
            downloadSizeMB: Number(metadata.fileSizeMB),

            geometry: metadata.geometry,
            materials: metadata.materials.count,

            textures: {
              present: metadata.textures.present,
              count: metadata.textures.count,
            },

            uvLayers: metadata.uvLayers,
            vertexColors: metadata.vertexColors,

            animations: metadata.animations,
            rigged: metadata.rigged,
            morphTargets: metadata.morphTargets,

            transforms: {
              scale: metadata.transforms.scale,
              position: metadata.transforms.position,
              rotation: {
                values: metadata.transforms.rotation.slice(0, 3),
                order: "XYZ",
              },
            },

            boundingBox: metadata.boundingBox,
            center: metadata.center,
          },
        });
      }

      const post = await AllPost.create({
        user: req.user.id,
        description,
        type: "model_post",
        modelPost: {
          title,
          price,
          assets: processedAssets,
        },
      });

      return res.status(201).json({
        message: "Model post created successfully",
        post,
      });
    }

    /* ======================================================
       GAME POST  ⭐ NEW
    ====================================================== */
    if (type === "game_post") {
      const { description, game } = req.body;
      console.log("Game post data:", req.body);

      if (!description || !game) {
        return res.status(400).json({
          message: "Description and game data required",
        });
      }

      const {
        gameName,
        version,
        platform,
        buildType,
        startPath,
        engine,
        runMode,
        price,
        systemRequirements,
        file,
      } = game;

      
      /* ---------- REQUIRED VALIDATION ---------- */
      if (!gameName || !startPath || !file?.url || !file?.name) {
        return res.status(400).json({
          message: "Missing required game fields",
        });
      }

      // Security: startPath must be relative
      if (startPath.startsWith("/") || startPath.includes("..")) {
        return res.status(400).json({
          message: "Invalid startPath (must be relative)",
        });
      }

      // Lock platform for now
      if (platform !== "windows") {
        return res.status(400).json({
          message: "Only Windows platform is supported currently",
        });
      }

      const post = await AllPost.create({
        user: req.user.id,
        description,
        type: "game_post",
        gamePost: {
  gameName,
  version: version || "1.0.0",
  platform: "windows",
  buildType,
  startPath,
  engine,
  runMode: runMode || "sandboxed",
  price: Number(price) || 0,

  systemRequirements: {
    ramGB: systemRequirements?.ramGB ?? null,
    cpuCores: systemRequirements?.cpuCores ?? null,
    gpuRequired: systemRequirements?.gpuRequired ?? false,
  },

  file: {
    name: file.name,
    url: file.url,
    size: file.size,
  },

  verification: {
    status: "pending",
    error: null,
    verifiedAt: null,
  },
},

      });

      return res.status(201).json({
        message: "Game post created successfully",
        post,
      });
    }

    /* ====================================================== */
    return res.status(400).json({ message: "Invalid post type" });
  } catch (err) {
    console.error("Create post error:", err);
    return res.status(500).json({ message: "Failed to create post" });
  }
};
