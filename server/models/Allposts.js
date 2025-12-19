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
    media: [
      {
        url: { type: String, required: true },
        type: { 
          type: String, 
          enum: ["image", "video"], 
          required: true 
        },
        thumbnail: { type: String }, // Useful for video previews
      }
    ]
  },
  { _id: false }
);
const GamePostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    
    platform: { 
      type: String, 
      enum: ["windows", "mac", "linux"], 
      required: true 
    },
    
    download: {
      zipUrl: { type: String, required: true },
      sizeMB: { type: Number, required: true }
    },
    
    screenshots: [{ type: String }], // Array of image URLs
    
    minRequirements: {
      cpu: { type: String, required: true },
      ram: { type: String, required: true },
      gpu: { type: String, required: true }
    }
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
      enum: ["normal_post", "model_post", "game_post"],
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
  },
  { timestamps: true }
);

export default mongoose.model("AllPost", PostSchema);
