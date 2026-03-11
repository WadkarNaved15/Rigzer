// models/PocketFeedEntry.js
import mongoose from "mongoose";

/**
 * ONE document per Pocket (not per approval).
 *
 * Feed ordering uses `publishedAt` descending — reset to now() on every
 * approval so the pocket always surfaces as fresh content without needing
 * a new _id. This preserves the stable _id reference used by analytics,
 * likes, comments, and any client-side caches.
 */
const PocketFeedEntrySchema = new mongoose.Schema(
  {
    pocket: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Pocket",
      required: true,
      unique:   true,
      index:    true,
    },
    owner: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },

    // Denormalised at publish time — updated in-place on each re-approval.
    brandName:         { type: String, required: true },
    tagline:           { type: String, default: "" },
    compiledBundleUrl: { type: String, required: true },

    // Feed position — set to Date.now() on every approval so the pocket
    // always sorts above older content. Indexed for fast feed queries.
    publishedAt: {
      type:     Date,
      required: true,
      index:    true,
    },

    // Counters — reset on every approval (each update is a fresh post).
    likesCount:    { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("PocketFeedEntry", PocketFeedEntrySchema);