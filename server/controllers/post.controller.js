import AllPost from "../models/Allposts.js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../s3.js";
import { extractMetadataFromUrl } from "../services/modelMetaData.service.js";
import { onPostCreated } from "../services/gorse.hooks.js";
import Like from "../models/Like.js";
import Comment from "../models/Comment.js";
import Wishlist from "../models/Wishlist.js";
import Notification from "../models/Notifications.js";
import { extractS3KeyFromUrl } from "../utils/extractS3Key.js";
import { videoProcessingQueue } from "../queues/videoQueue.js";
import { deletePostAndAssets } from "../services/deletePost.js";
import { parseMentions } from "../utils/mentions.js";
import { sendEventToQueue } from "../utils/sendEventToQueue.js";
import { enqueueSemanticTaggingJob } from "../services/semanticTaggingQueue.js";

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
      const { description = "", assets = [] } = req.body;

      // At least one of description or media is required
      if (!description.trim() && assets.length === 0) {
        return res.status(400).json({
          message: "Post must contain text or media.",
        });
      }

      // If media is present, it must be between 1 and 4
      if (assets.length > 4) {
        return res.status(400).json({
          message: "A post can contain at most 4 media assets.",
        });
      }

      const mentionData =
        await parseMentions(description);

      const post = await AllPost.create({
        user: req.user.id,
        description,
        mentions:
          mentionData.mentions,
        hasInteractMention:
          mentionData.hasInteractMention,
        type: "normal_post",
        normalPost: {
          assets: assets.map((asset) => {
            const isVideo = asset.type === "video";
            return {
              name: asset.name,
              url: asset.url,
              key: asset.key,
              type: asset.type,
              ...(isVideo && { processingStatus: "pending" }) // Set initial status
            };
          }),
        },
      });

      // 🚀 Dispatch to FFmpeg Worker for any videos
      for (const asset of post.normalPost.assets) {
        if (asset.type === "video") {
          await videoProcessingQueue.add('optimize-video', {
            key: asset.key,
            url: asset.url,
            entityType: 'post',
            entityId: post._id.toString()
          }, {
            removeOnComplete: true,
            attempts: 3
          });
        }

        if (asset.type === "image" || asset.type === "video") {
          await enqueueSemanticTaggingJob({
            postId: post._id.toString(),
            bucket: process.env.AWS_BUCKET_NAME,
            key: asset.key,
            mediaType: asset.type,
            operation: "semantic_tagging",
            contentVersion:
              asset.semanticTagging?.contentVersion || 1,
          });
        }
      }

      sendEventToQueue({
        type: "POST_CREATED",
        actorId: req.user.id,
        postId: post._id,
      });
      // ✅ GORSE: sync new post (fire-and-forget)
      onPostCreated(post);

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

          fieldOfView: asset.fieldOfView || "auto",

          background: {
            type: asset.background?.type || "solid",
            color: asset.background?.color || "#00000000",
            color1: asset.background?.color1 || "#1e293b",
            color2: asset.background?.color2 || "#0f172a",
          },
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

      const mentionData =
        await parseMentions(description);

      const post = await AllPost.create({
        user: req.user.id,
        description,
        mentions: mentionData.mentions,
        hasInteractMention: mentionData.hasInteractMention,
        type: "model_post",
        modelPost: {
          title,
          price,
          assets: processedAssets,
        },
      });

      sendEventToQueue({
        type: "POST_CREATED",
        actorId: req.user.id,
        postId: post._id,
      });


      // ✅ GORSE: sync new post (fire-and-forget)
      onPostCreated(post);
      return res.status(201).json({
        message: "Model post created successfully",
        post,
      });
    }

    /* ======================================================
       GAME POST
    ====================================================== */
    if (type === "game_post") {
      console.log("Game post controller got hit");
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
        maxSessionDurationMinutes,
        systemRequirements,
        file,
        videoDemo
      } = game;



      const allowedFormats = ["7z", "zip"];
      if (!file?.format || !allowedFormats.includes(file.format)) {
        return res.status(400).json({
          message: "Unsupported or missing game build format",
        });
      }

      if (
        !Number.isInteger(maxSessionDurationMinutes) ||
        maxSessionDurationMinutes < 1 ||
        maxSessionDurationMinutes > 120
      ) {
        return res.status(400).json({
          message: "Maximum session duration must be between 1 and 120 minutes.",
        });
      }

      const buildType = deriveBuildType(file.format);

      if (!gameName || !startPath || !file?.url || !file?.name || !file?.format || !file?.key) {
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

      console.log(
        "Received video demo:",
        JSON.stringify(game.videoDemo, null, 2)
      );

      const mentionData =
        await parseMentions(description);

      const post = await AllPost.create({
        user: req.user.id,
        description,
        mentions: mentionData.mentions,
        hasInteractMention: mentionData.hasInteractMention,
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
          maxSessionDurationMinutes:
            maxSessionDurationMinutes ?? 10,
          systemRequirements: {
            ramGB: systemRequirements?.ramGB ?? null,
            cpuCores: systemRequirements?.cpuCores ?? null,
            gpuRequired: systemRequirements?.gpuRequired ?? false,
          },
          file: {
            name: file.name,
            key: file.key,
            url: file.url,
            size: file.size,
            format: file.format,
          },
          videoDemo: videoDemo
            ? {
              name: videoDemo.name,
              key: videoDemo.key,
              url: videoDemo.url,
              size: videoDemo.size,
            }
            : null,
          verification: {
            status: "pending",
            error: null,
            verifiedAt: null,
          },
        },
      });

      sendEventToQueue({
        type: "POST_CREATED",
        actorId: req.user.id,
        postId: post._id,
      });
      console.log("Game post created successfully");
      // ✅ GORSE: sync new post (fire-and-forget)
      onPostCreated(post);
      console.log("Game post sent to gorse");
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

      const { brandName, bgMode, bgColor, bgImageUrl, bgImagePosition, bgImageSize, overlayOpacity, logoUrl, asset, ctaText, ctaLink, style } = adModelPost;

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
          fieldOfView: asset.fieldOfView || "auto",
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
          fieldOfView: asset.fieldOfView || "auto",
          optimization: { status: "pending" },
        };
      }

      const mentionData =
        await parseMentions(description);

      const post = await AllPost.create({
        user: req.user.id,
        description: description || "",
        mentions: mentionData.mentions,
        hasInteractMention: mentionData.hasInteractMention,
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
          ctaText: ctaText?.trim() || undefined,
          ctaLink: ctaLink?.trim() || undefined,
          style: {
            ctaColor: style?.ctaColor || "#3D7A6E",
          },
        },
      });

      sendEventToQueue({
        type: "POST_CREATED",
        actorId: req.user.id,
        postId: post._id,
      });

      // ✅ GORSE: sync new post (fire-and-forget)
      onPostCreated(post);

      return res.status(201).json({
        message: "Ad model post created successfully",
        post,
      });
    }

    /* ======================================================
       MEDIA AD POST
    ====================================================== */
    if (type === "media_ad_post") {
      const { description, mediaAdPost } = req.body;

      if (!mediaAdPost) {
        return res.status(400).json({
          message: "mediaAdPost data is required",
        });
      }

      const {
        brandName,
        brandLogo,
        ctaText,
        ctaLink,
        asset,
        style,
      } = mediaAdPost;

      // ───────── VALIDATE ASSET ─────────
      if (!asset || !asset.url || !asset.key || !asset.name || !asset.type) {
        return res.status(400).json({
          message: "Media ad post requires a valid asset",
        });
      }

      // ───────── VALIDATE BRAND ─────────
      if (!brandName) {
        return res.status(400).json({
          message: "brandName is required",
        });
      }

      const isVideo = mediaAdPost.asset.type === "video";

      const mentionData =
        await parseMentions(description);

      // ───────── CREATE POST ─────────
      const post = await AllPost.create({
        user: req.user.id,
        description: description || "",
        mentions: mentionData.mentions,
        hasInteractMention: mentionData.hasInteractMention,
        type: "media_ad_post",

        mediaAdPost: {
          brandName: brandName.trim(),
          brandLogo: brandLogo || null,

          description: description || "",
          ctaText: ctaText || "",
          ctaLink: ctaLink || "",

          asset: {
            name: mediaAdPost.asset.name,
            type: mediaAdPost.asset.type,
            url: mediaAdPost.asset.url,
            key: mediaAdPost.asset.key,
            ...(isVideo && { processingStatus: "pending" }) // Set initial status
          },

          style: {
            accentColor: style?.accentColor || "#6366f1",
            useGlowEffect: style?.useGlowEffect ?? true,
            cardLayoutTheme: style?.cardLayoutTheme || "glass",
          },

          performance: {
            clicks: 0,
            impressions: 0,
          },
        },
      });

      if (isVideo) {
        await videoProcessingQueue.add('optimize-video', {
          key: mediaAdPost.asset.key,
          url: mediaAdPost.asset.url,
          entityType: 'media_ad',
          entityId: post._id.toString()
        }, {
          removeOnComplete: true,
          attempts: 3
        });
      }

      sendEventToQueue({
        type: "POST_CREATED",
        actorId: req.user.id,
        postId: post._id,
      });

      // optional analytics hook (same pattern as others)
      onPostCreated(post);

      return res.status(201).json({
        message: "Media ad post created successfully",
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
export const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await AllPost.findById(postId);

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
      });
    }

    // =====================================================
    // OWNERSHIP CHECK
    // =====================================================

    if (post.user.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
        message: "Unauthorized",
      });
    }

    await deletePostAndAssets(post);

    res.json({
      success: true,
      message: "Post deleted successfully",
    });

  } catch (err) {
    console.error("Delete post error:", err);

    res.status(500).json({
      message: "Failed to delete post",
    });
  }
};