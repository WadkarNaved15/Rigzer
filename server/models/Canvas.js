import mongoose from "mongoose";

const ArticleSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    subtitle: {
      type: String,
    },

    author_name: {
      type: String,
      required: true,
    },

    hero_image_url: {
      type: String, // CloudFront URL
    },

    content: {
      type: Object, // TipTap JSON
      required: true,
    },

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      index: true,
    },

    publishedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Article", ArticleSchema);
