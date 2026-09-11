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

    fieldOfView: {
      type: String,
      default: "auto", // Your current default from ExePost
    },

    background: {
      type: {
        type: String,
        enum: [
          "solid",
          "gradient",
          "focus",
          "stripes",
          "spotlight",
        ],
        default: "solid",
      },

      color: {
        type: String,
        default: "#00000000",
      },

      color1: {
        type: String,
        default: "#1e293b",
      },

      color2: {
        type: String,
        default: "#0f172a",
      },
    },

    optimization: {
      status: {
        type: String,
        enum: [
          "pending",
          "processing",
          "completed",
          "failed",
        ],
        default: "pending",
      },

      retryCount: {
        type: Number,
        default: 0,
      },

      updatedAt: {
        type: Date,
        default: Date.now,
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

        type: {
          type: String,
          enum: ["image", "video"],
          required: true,
        },

        // original
        url: String,
        key: String,

        // video only
        optimizedUrl: String,
        optimizedKey: String,

        thumbnailUrl: String,

        processingStatus: {
          type: String,
          enum: [
            "pending",
            "processing",
            "completed",
            "failed",
          ],
          default: "pending",
        },

        processingError: {
          type: String,
          default: null,
        },

        uploadedAt: {
          type: Date,
          default: null,
        },

        processedAt: {
          type: Date,
          default: null,
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
    isTestUpload: {
      type: Boolean,
      default: false,
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
    steamUrl: {
      type: String,
      trim: true,
      default: "",
    },
    runMode: {
      type: String,
      enum: ["sandboxed"],
      default: "sandboxed",
    },
    maxSessionDurationMinutes: {
      type: Number,
      default: 10,
      min: 1,
      max: 120,
      validate: {
        validator: Number.isInteger,
        message: "Session duration must be a whole number of minutes",
      },
    },
    launch: {
      status: {
        type: String,
        enum: [
          "coming_soon",
          "live"
        ],
        default: "live",
      },

      launchAt: {
        type: Date,
        default: null,
      },

      launchedAt: {
        type: Date,
        default: null,
      },
    },
    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
    },
    sponsorship: {
      enabled: {
        type: Boolean,
        default: false
      },

      initialCredits: {
        type: Number,
        default: 0,
        min: 0
      },
      sponsoredBy:
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
      },

      sponsoredAt:
      {
        type: Date,
        default: null
      },

      notes:
      {
        type: String,
        default: null
      },
    },
    videoDemo: {
      name: {
        type: String,
        default: null,
      },

      // Original upload
      key: {
        type: String,
        default: null,
      },

      url: {
        type: String,
        default: null,
      },

      // Optimized video
      optimizedKey: {
        type: String,
        default: null,
      },

      optimizedUrl: {
        type: String,
        default: null,
      },

      // Generated thumbnail
      thumbnailUrl: {
        type: String,
        default: null,
      },

      size: {
        type: Number,
        default: null,
      },

      processingStatus: {
        type: String,
        enum: [
          "pending",
          "processing",
          "completed",
          "failed",
        ],
        default: "pending",
      },

      processingError: {
        type: String,
        default: null,
      },

      uploadedAt: {
        type: Date,
        default: null,
      },

      processedAt: {
        type: Date,
        default: null,
      },
    },
    systemRequirements: {
      ramGB: { type: Number, min: 1 },
      cpuCores: { type: Number, min: 1 },
      gpuRequired: { type: Boolean, default: false },
    },
    file: {
      name: { type: String, required: true },
      key: { type: String, required: true },
      url: { type: String, required: true },
      size: { type: Number, required: true },
      format: {
        type: String,
        enum: ["7z", "zip", "exe"],
        required: true,
      },
    },

// ── Prepared game snapshots ─────────────────────────────
snapshot: {
  status: {
    type: String,
    enum: [
      "pending",
      "provisioning",
      "snapshotting",
      "replicating",
      "ready",
      "failed",
    ],
    default: "pending",
    index: true,
  },

  sourceRegion: {
    type: String,
    default: "ap-south-1",
  },

  sourceSnapshotId: {
    type: String,
    default: null,
  },

  // Temporary builder volume.
  // This should be cleared after cleanup.
  sourceVolumeId: {
    type: String,
    default: null,
  },

  regions: [{
    _id: false,

    region: {
      type: String,
      required: true,
    },

    snapshotId: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "copying",
        "ready",
        "failed",
      ],
      default: "pending",
    },

    error: {
      type: String,
      default: null,
    },

    createdAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  }],

  error: {
    type: String,
    default: null,
  },

  createdAt: {
    type: Date,
    default: null,
  },

  completedAt: {
    type: Date,
    default: null,
  },
},
    gameMetrics: {
      totalSessions: {
        type: Number,
        default: 0,
      },

      totalSessionTimeMs: {
        type: Number,
        default: 0,
      },

      uniquePlayers: {
        type: Number,
        default: 0,
      },
      sessionRequests: {
        type: Number,
        default: 0,
      },
    },

    creditBudget: {
      purchasedCredits: {
        type: Number,
        default: 0,
      },

      giftedCredits: {
        type: Number,
        default: 0,
      },

      deductedCredits: {
        type: Number,
        default: 0,
      },

      usedCredits: {
        type: Number,
        default: 0,
      },

      remainingCredits: {
        type: Number,
        default: 0,
      },

      status: {
        type: String,
        enum: [
          "active",
          "low_credits",
          "exhausted",
        ],
        default: "active",
      },

      exhaustedAt: {
        type: Date,
        default: null,
      },

      lastCreditAddedAt: {
        type: Date,
        default: null,
      },
    },
    visibility: {
      type: String,
      enum: [
        "active",
        "hidden",
        "credit_exhausted",
      ],
      default: "active",
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

GamePostSchema.virtual("sessionStats").get(function () {
  const totalCredits =
    (this.creditBudget?.usedCredits || 0) +
    (this.creditBudget?.remainingCredits || 0);

  return {
    completedSessions: this.gameMetrics?.totalSessions || 0,
    possibleSessions: Math.floor(totalCredits / 10),
  };
});
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

    fieldOfView: {
      type: String,
      default: "auto", // Your current default from ExePost
    },

    optimization: {
      status: {
        type: String,
        enum: [
          "pending",
          "processing",
          "completed",
          "failed",
        ],
        default: "pending",
      },

      retryCount: {
        type: Number,
        default: 0,
      },

      updatedAt: {
        type: Date,
        default: Date.now,
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
    ctaText: {
      type: String,
      trim: true,
      default: undefined, // Keeps it clean if no CTA text is provided
    },
    ctaLink: {
      type: String,
      trim: true,
      default: undefined,
    },
    style: {
      ctaColor: {
        type: String,
        default: '#3D7A6E', // Matches your default frontend accent color
      },
    },
  },
  { _id: false }
);
/* ======================================================
   AD MEDIA POST SCHEMA  ⭐ NEW
====================================================== */
const MediaAdAssetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: ["image", "video"],
      required: true,
    },

    // Original asset
    url: {
      type: String,
      required: true,
    },

    key: {
      type: String,
      required: true,
    },

    // Video-only fields
    optimizedUrl: {
      type: String,
      default: null,
    },

    optimizedKey: {
      type: String,
      default: null,
    },

    thumbnailUrl: {
      type: String,
      default: null,
    },

    sizeMB: Number,

    processingStatus: {
      type: String,
      enum: [
        "pending",
        "processing",
        "completed",
        "failed",
      ],
      default: "pending",
    },

    processingError: {
      type: String,
      default: null,
    },

    uploadedAt: {
      type: Date,
      default: null,
    },

    processedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const MediaAdPostSchema = new mongoose.Schema(
  {
    brandName: {
      type: String,
      trim: true,
      maxlength: 80,
      required: true,
    },

    brandLogo: {
      type: String,
      default: null,
    },

    description: {
      type: String,
      default: "",
      maxlength: 2000,
    },

    ctaText: {
      type: String,
      default: "",
      maxlength: 60,
    },

    ctaLink: {
      type: String,
      default: "",
    },

    asset: {
      type: MediaAdAssetSchema,
      required: true,
    },

    style: {
      accentColor: { type: String, default: "#6366f1" },
      useGlowEffect: { type: Boolean, default: true },

      cardLayoutTheme: {
        type: String,
        enum: ["glass", "gradient", "minimal"],
        default: "glass",
      },
    },

    performance: {
      clicks: { type: Number, default: 0 },
      impressions: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
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

    mentions: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      originalUsername: {
        type: String,
        required: true,
      },
    }],

    hasInteractMention: {
      type: Boolean,
      default: false,
    },

    type: {
      type: String,
      enum: [
        "normal_post",
        "model_post",
        "game_post",
        "canvas_article",
        "devlog_post",
        "ad_model_post",
        "media_ad_post",
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
    viewsCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    uniqueViewsCount: {
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

    mediaAdPost: {
      type: MediaAdPostSchema,
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
PostSchema.index(
  {
    description: "text",
    "modelPost.title": "text",
    "gamePost.gameName": "text",
    "adModelPost.brandName": "text",
  },
  {
    weights: {
      "modelPost.title": 5,
      "gamePost.gameName": 5,
      "adModelPost.brandName": 4,
      description: 2,
    },
    name: "PostSearchIndex",
  }
);
PostSchema.index({ mentions: 1 });
PostSchema.index({ createdAt: -1 });
PostSchema.index({
  "modelPost.assets.optimization.status": 1,
  "modelPost.assets.optimization.updatedAt": 1,
});

PostSchema.index({
  "adModelPost.asset.optimization.status": 1,
  "adModelPost.asset.optimization.updatedAt": 1,
});

const AllPost =
  mongoose.models.AllPost ||
  mongoose.model(
    "AllPost",
    PostSchema
  );

export default AllPost;