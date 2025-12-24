import AllPost from "../models/Allposts.js";
import { extractMetadataFromUrl } from "../services/modelMetaData.service.js";
export const createPost = async (req, res) => {
  console.log("Create post controller got hit");
  try {
    const { type, title, description, price, assets } = req.body;
    if (!type || !description) {
      return res.status(400).json({ message: "Type and description required" });
    }
    if (type === "normal_post") {
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
            type: asset.type, // "image" | "video"
          })),
        },
      });

      return res.status(201).json({
        message: "Media post created successfully",
        post,
      });
    }
    if (type === "model_post") {
      if (!title || price === undefined) {
        return res.status(400).json({
          message: "Model post requires title and price",
        });
      }

      if (!assets || assets.length === 0 || assets.length > 4) {
        return res.status(400).json({ message: "Model post must have 1–4 assets" });
      }

      // 🔹 Extract metadata for each asset
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
              count: metadata.materials.count,
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

      // 🔹 Create Post
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

      res.status(201).json({
        message: "Model post created successfully",
        post,
      });
    }
    return res.status(400).json({ message: "Invalid post type" });
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ message: "Failed to create post" });
  }
};
