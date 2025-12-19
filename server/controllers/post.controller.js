import AllPost from "../models/Allposts.js";
import { extractMetadataFromUrl } from "../services/modelMetaData.service.js";
export const createPost = async (req, res) => {
  console.log("Create post controller got hit");
  try {
    const { type, title, description, price, assets } = req.body;

    if (type !== "model_post") {
      return res.status(400).json({ message: "Only model_post supported for now" });
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
      title,
      description,
      type: "model_post",
      modelPost: {
        price,
        assets: processedAssets,
      },
    });

    res.status(201).json({
      message: "Model post created successfully",
      post,
    });
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ message: "Failed to create post" });
  }
};
