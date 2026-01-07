import mongoose from "mongoose";
const ModelAssetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    url: { type: String, required: true }, // CloudFront GLB

    sizeMB: Number,

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
      min: [0, "Price cannot be negative"] 
    },
    assets: {
      type: [ModelAssetSchema],
      validate: {
        validator: function(arr) {
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
          type: String, // "image" | "video"
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
      enum: ["windows"], // lock for now
      required: true,
    },

    buildType: {
      type: String,
      enum: ["windows_exe", "windows_zip"],
      required: true,
    },

    /** ⭐ CRITICAL: what the VM will execute */
    startPath: {
      type: String,
      required: true,
      validate: {
        validator: (v) =>
          !v.startsWith("/") && !v.includes(".."),
        message: "startPath must be a relative path",
      },
    },

    engine: {
      type: String, // Unity / Unreal / Godot
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

    /** System requirements for pricing & scheduling */
    systemRequirements: {
      ramGB: { type: Number, min: 1 },
      cpuCores: { type: Number, min: 1 },
      gpuRequired: { type: Boolean, default: false },
    },

    /** Uploaded build info */
    file: {
      name: { type: String, required: true },
      url: { type: String, required: true }, // CloudFront URL
      size: { type: Number, required: true }, // bytes
    },
    verification: {
  status: {
    type: String,
    enum: ["pending", "verified", "failed"],
    default: "pending",
  },
  error: {
    type: String,
    default: null,
  },
  verifiedAt: {
    type: Date,
    default: null,
  },
},

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
      required: true,
    },

    type: {
      type: String,
      enum: ["normal_post", "model_post", "game_post","canvas_article"],
      required: true,
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
      canvasRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Canvas",
      default: null,
    },
  },
  { timestamps: true }
);


export default mongoose.model("AllPost", PostSchema);
