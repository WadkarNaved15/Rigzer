// models/PocketFeedEntry.js
import mongoose from "mongoose";

/**
 * ONE document per Pocket (not per approval).
 *
 * On first approval:  document is created   → createdAt set by Mongoose timestamps
 * On re-approval:     document is $set       → compiledBundleUrl updated, likes preserved
 *
 * Feed ordering uses _id (ObjectId) descending — stable, indexed, no ties.
 * compiledBundleUrl points to a versioned S3 key so PocketPost.tsx always
 * fetches the latest bundle without any CloudFront invalidation needed.
 */
const PocketFeedEntrySchema = new mongoose.Schema(
  {
    pocket: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Pocket",
      required: true,
      unique:   true,  // enforces one entry per Pocket at the DB level
      index:    true,
    },
    owner: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },

    // Denormalised at publish time — avoids a join on every feed load.
    // Updated in-place on each re-approval via $set.
    brandName:         { type: String, required: true },
    tagline:           { type: String, default: "" },
    compiledBundleUrl: { type: String, required: true },

    likesCount:    { type: Number, default: 0, index: true },
    commentsCount: { type: Number, default: 0 },
  },
  {
    // createdAt = first publish timestamp (immutable after insert)
    // updatedAt = last re-approval timestamp (updated on every $set)
    timestamps: true,
  }
);

export default mongoose.model("PocketFeedEntry", PocketFeedEntrySchema);