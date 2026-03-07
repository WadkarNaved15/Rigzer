import AllPost from "../models/Allposts.js";
import { extractMetadataFromUrl } from "../services/modelMetaData.service.js";

function deriveBuildType(fileFormat) {
  if (fileFormat === "exe") return "executable";
  return "archive";
}

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
            type: asset.type,
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
        const metadata = await extractMetadataFromUrl(asset.originalUrl);

        processedAssets.push({
          name: asset.name,
          originalKey: asset.originalKey,
          optimizedKey: null,
          originalUrl: asset.originalUrl,
          optimizedUrl: null,
          sizeMB: Number(metadata.fileSizeMB),
          optimization: { status: "pending" },
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
       GAME POST
    ====================================================== */
    if (type === "game_post") {
      const { description, game } = req.body;

      if (!description || !game) {
        return res.status(400).json({
          message: "Description and game data required",
        });
      }

      const {
        gameName,
        version,
        platform,
        startPath,
        engine,
        runMode,
        price,
        systemRequirements,
        file,
      } = game;

      const allowedFormats = ["7z", "zip", "exe"];
      if (!file?.format || !allowedFormats.includes(file.format)) {
        return res.status(400).json({
          message: "Unsupported or missing game build format",
        });
      }

      const buildType = deriveBuildType(file.format);

      if (!gameName || !startPath || !file?.url || !file?.name || !file?.format) {
        return res.status(400).json({ message: "Missing required game fields" });
      }

      if (buildType === "executable" && !startPath.toLowerCase().endsWith(".exe")) {
        return res.status(400).json({
          message: "Executable builds must have a .exe startPath",
        });
      }

      if (startPath.startsWith("/") || startPath.includes("..")) {
        return res.status(400).json({
          message: "Invalid startPath (must be relative)",
        });
      }

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
            format: file.format,
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

    /* ======================================================
       AD MODEL POST  ⭐ NEW
    ====================================================== */
    if (type === "ad_model_post") {
      const { description, adModelPost } = req.body;

      if (!adModelPost) {
        return res.status(400).json({ message: "adModelPost data is required" });
      }

      const { brandName, bgMode, bgColor, bgImageUrl, bgImagePosition, bgImageSize, overlayOpacity, logoUrl, asset } = adModelPost;

      // ── Validate asset ───────────────────────────────────
      if (!asset || !asset.originalUrl || !asset.originalKey || !asset.name) {
        return res.status(400).json({
          message: "Ad model post requires exactly one valid model asset",
        });
      }

      // ── Validate background config ───────────────────────
      const resolvedBgMode = bgMode === "image" ? "image" : "color";

      if (resolvedBgMode === "image" && !bgImageUrl) {
        return res.status(400).json({
          message: "bgImageUrl is required when bgMode is 'image'",
        });
      }

      // ── Extract model metadata (same pipeline as model_post) ──
      let processedAsset;
      try {
        const metadata = await extractMetadataFromUrl(asset.originalUrl);

        processedAsset = {
          name: asset.name,
          originalKey: asset.originalKey,
          optimizedKey: null,
          originalUrl: asset.originalUrl,
          optimizedUrl: null,
          sizeMB: Number(metadata.fileSizeMB),
          optimization: { status: "pending" },
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
        };
      } catch (metaErr) {
        console.error("Metadata extraction failed for ad model post:", metaErr);
        // Don't block creation if metadata fails — store minimal info
        processedAsset = {
          name: asset.name,
          originalKey: asset.originalKey,
          optimizedKey: null,
          originalUrl: asset.originalUrl,
          optimizedUrl: null,
          optimization: { status: "pending" },
        };
      }

      const post = await AllPost.create({
        user: req.user.id,
        description: description || "",
        type: "ad_model_post",
        adModelPost: {
          brandName: brandName?.trim() || null,
          logoUrl: logoUrl || null,
          bgMode: resolvedBgMode,
          bgColor: resolvedBgMode === "color" ? (bgColor || "#6366f1") : null,
          bgImageUrl: resolvedBgMode === "image" ? bgImageUrl : null,
          bgImagePosition: resolvedBgMode === 'image' ? (bgImagePosition || '50% 50%') : '50% 50%',
          bgImageSize: resolvedBgMode === 'image' ? (bgImageSize || 'cover') : 'cover',
          overlayOpacity: overlayOpacity !== undefined ? Math.max(0, Math.min(80, overlayOpacity)) : 30,
          asset: processedAsset,
        },
      });

      return res.status(201).json({
        message: "Ad model post created successfully",
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