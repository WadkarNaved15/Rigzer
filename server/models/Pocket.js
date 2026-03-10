// models/Pocket.js
import mongoose from "mongoose";

const PocketAnalyticsSchema = new mongoose.Schema(
  {
    impressions:            { type: Number, default: 0 },
    clicks:                 { type: Number, default: 0 },
    totalEngagementSeconds: { type: Number, default: 0 },
  },
  { _id: false }
);

const PocketSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    brandName:  { type: String, trim: true, maxlength: 80,  required: true },
    tagline:    { type: String, trim: true, maxlength: 160, default: "" },

    // The single source-of-truth for the creator's JSX.
    // Overwritten on every save — no history kept (per spec).
    sourceCode: { type: String, required: true, maxlength: 60_000 },

    // Workflow state for the current code
    status: {
      type: String,
      enum: ["draft", "pending_review", "approved", "rejected", "live"],
      default: "draft",
    },

    // Populated by admin on rejection
    reviewNote: { type: String, default: null },

    // CDN URL of the compiled JS bundle — null until first successful publish
    compiledBundleUrl: { type: String, default: null },

    analytics: { type: PocketAnalyticsSchema, default: () => ({}) },

    suspended: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Pocket", PocketSchema);