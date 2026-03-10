// models/PocketFeedEntry.js
import mongoose from "mongoose";

/**
 * One document is created per approved publish event.
 * Its `createdAt` drives chronological feed ordering, so every approved
 * update surfaces as fresh content even though the Pocket itself is
 * mutated in place.
 *
 * The feed service merges these with AllPost documents and tags them
 * feedType: "pocket_update" so Post.tsx routes to <PocketPost />.
 */
const PocketFeedEntrySchema = new mongoose.Schema(
  {
    pocket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pocket",
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Denormalised at publish time — avoids a join on every feed load
    brandName:         { type: String, required: true },
    tagline:           { type: String, default: "" },
    compiledBundleUrl: { type: String, required: true },

    // Standard counters — existing useLikes / PostInteractions work unchanged
    likesCount:    { type: Number, default: 0, index: true },
    commentsCount: { type: Number, default: 0 },
  },
  { timestamps: true } // createdAt = publish timestamp = feed position
);

export default mongoose.model("PocketFeedEntry", PocketFeedEntrySchema);