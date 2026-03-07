import mongoose from "mongoose";

const ModelAssetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    /** S3 Keys */
    originalKey: { type: String, required: true },
    optimizedKey: { type: String, default: null },

    /** Public URLs */
    originalUrl: { type: String, required: true },
    optimizedUrl: { type: String, default: null },

    sizeMB: Number,

    optimization: {
      status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed"],
        default: "pending",
      },
      optimizedSizeMB: Number,
      compressionRatio: Number,
      error: String,
      processedAt: Date,
    },

    metadata: {
      fileName: String,
      downloadSizeMB: Number,
      geometry: {
        meshes: Number,
        vertices: Number,
        triangles: Number,
      },
      materials: Number,
      textures: {
        present: Boolean,
        count: Number,
      },
      uvLayers: Number,
      vertexColors: Boolean,
      animations: {
        present: Boolean,
        count: Number,
      },
      rigged: Boolean,
      morphTargets: Boolean,
      transforms: {
        scale: [Number],
        position: [Number],
        rotation: {
          values: [Number],
          order: String,
        },
      },
      boundingBox: {
        width: Number,
        height: Number,
        depth: Number,
      },
      center: {
        x: Number,
        y: Number,
        z: Number,
      },
    },
  },
  { _id: false }
);

const ModelPostSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
    },
    assets: {
      type: [ModelAssetSchema],
      validate: {
        validator: function (arr) {
          return arr.length > 0 && arr.length <= 4;
        },
        message: "Model post must have 1–4 assets",
      },
    },
    previewImage: String,
  },
  { _id: false }
);

const NormalPostSchema = new mongoose.Schema(
  {
    assets: [
      {
        name: String,
        url: String,
        type: {
          type: String,
          enum: ["image", "video"],
          required: true,
        },
      },
    ],
  },
  { _id: false }
);

const GamePostSchema = new mongoose.Schema(
  {
    gameName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    version: {
      type: String,
      default: "1.0.0",
    },
    platform: {
      type: String,
      enum: ["windows"],
      required: true,
    },
    buildType: {
      type: String,
      enum: ["archive", "executable"],
      required: true,
    },
    startPath: {
      type: String,
      required: true,
      validate: {
        validator: (v) => !v.startsWith("/") && !v.includes(".."),
        message: "startPath must be a relative path",
      },
    },
    engine: {
      type: String,
      trim: true,
    },
    runMode: {
      type: String,
      enum: ["sandboxed"],
      default: "sandboxed",
    },
    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
    },
    systemRequirements: {
      ramGB: { type: Number, min: 1 },
      cpuCores: { type: Number, min: 1 },
      gpuRequired: { type: Boolean, default: false },
    },
    file: {
      name: { type: String, required: true },
      url: { type: String, required: true },
      size: { type: Number, required: true },
      format: {
        type: String,
        enum: ["7z", "zip", "exe"],
        required: true,
      },
    },
    verification: {
      status: {
        type: String,
        enum: ["pending", "verified", "failed"],
        default: "pending",
      },
      error: { type: String, default: null },
      verifiedAt: { type: Date, default: null },
    },
  },
  { _id: false }
);

/* ======================================================
   AD MODEL POST SCHEMA  ⭐ NEW
====================================================== */
const AdModelAssetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    /** S3 Keys */
    originalKey: { type: String, required: true },
    optimizedKey: { type: String, default: null },

    /** Public URLs */
    originalUrl: { type: String, required: true },
    optimizedUrl: { type: String, default: null },

    sizeMB: Number,

    optimization: {
      status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed"],
        default: "pending",
      },
      optimizedSizeMB: Number,
      compressionRatio: Number,
      error: String,
      processedAt: Date,
    },

    metadata: {
      fileName: String,
      downloadSizeMB: Number,
      geometry: {
        meshes: Number,
        vertices: Number,
        triangles: Number,
      },
      materials: Number,
      textures: {
        present: Boolean,
        count: Number,
      },
      uvLayers: Number,
      vertexColors: Boolean,
      animations: {
        present: Boolean,
        count: Number,
      },
      rigged: Boolean,
      morphTargets: Boolean,
      transforms: {
        scale: [Number],
        position: [Number],
        rotation: {
          values: [Number],
          order: String,
        },
      },
      boundingBox: {
        width: Number,
        height: Number,
        depth: Number,
      },
      center: {
        x: Number,
        y: Number,
        z: Number,
      },
    },
  },
  { _id: false }
);

// ── Diff: add bgImagePosition to AdModelPostSchema in Allposts.js ──────────
//
// In AdModelPostSchema, after bgImageUrl, add:
//
//   bgImagePosition: {
//     type: String,
//     default: '50% 50%',   // CSS backgroundPosition value, e.g. "40% 60%"
//   },
//
// Full updated AdModelPostSchema:

const AdModelPostSchema = new mongoose.Schema(
  {
    brandName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: null,
    },
    logoUrl: {
      type: String,
      default: null,
    },
    bgMode: {
      type: String,
      enum: ['color', 'image'],
      required: true,
      default: 'color',
    },
    bgColor: {
      type: String,
      default: '#6366f1',
    },
    bgImageUrl: {
      type: String,
      default: null,
    },
    /** CSS backgroundPosition string, e.g. "40% 60%". Only meaningful when bgMode === 'image'. */
    bgImagePosition: {
      type: String,
      default: '50% 50%',
    },
    bgImageSize: {
      type: String,
      default: 'cover', // e.g. "cover", "contain", "100px 200px"
    },
    overlayOpacity: {
      type: Number,
      default: 30,
      min: 0,
      max: 80,
    },
    asset: {
      type: AdModelAssetSchema,
      required: true,
    },
  },
  { _id: false }
);

/* ====================================================== */

const DevlogMetaSchema = new mongoose.Schema(
  {
    title: String,
    thumbnail: String,
  },
  { _id: false }
);

const PostSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    description: {
      type: String,
      default: "",   // optional for ad posts
    },

    type: {
      type: String,
      enum: [
        "normal_post",
        "model_post",
        "game_post",
        "canvas_article",
        "devlog_post",
        "ad_model_post", // ⭐ NEW
      ],
      required: true,
    },

    likesCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    commentsCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    normalPost: {
      type: NormalPostSchema,
      default: null,
    },

    modelPost: {
      type: ModelPostSchema,
      default: null,
    },

    gamePost: {
      type: GamePostSchema,
      default: null,
    },

    adModelPost: {           // ⭐ NEW
      type: AdModelPostSchema,
      default: null,
    },

    canvasRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Canvas",
      default: null,
    },
    devlogRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CanvasScene",
      default: null,
    },
    devlogMeta: {
      type: DevlogMetaSchema,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("AllPost", PostSchema);