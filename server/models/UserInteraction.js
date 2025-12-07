import mongoose from "mongoose";

const UserInteractionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  post: { type: mongoose.Schema.Types.ObjectId, ref: "RecommendationPost", required: true },

  viewedAt: { type: Date },
  playedDemo: { type: Boolean, default: false },
  playTime: { type: Number, default: 0 }, // seconds
  liked: { type: Boolean, default: false },
  commented: { type: Boolean, default: false },

  // rating system (important later)
  rating: { type: Number, min: 1, max: 5 },

}, { timestamps: true });

export default mongoose.model("UserInteraction", UserInteractionSchema);