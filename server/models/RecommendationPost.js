import mongoose from "mongoose";

const RecommendationPostSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  description: { type: String, required: true },
  type: {
    type: String,
    enum: ["normal_post", "game_post"],
    required: true,
    default: "normal_post"
  },
   // 🔥 For recommendation system:
  tags: [{ type: String }],          // e.g. FPS, Racing, Horror
  genre: { type: String },           // optional
  engine: { type: String },          // Unity / Unreal / Godot
  buildType: { type: String },       // demo / beta / prototype

  // Gameplay engagement (filled later)
  playCount: { type: Number, default: 0 },
  avgSession: { type: Number, default: 0 },   // in seconds
  completionRate: { type: Number, default: 0 },
  rageQuitRate: { type: Number, default: 0 },
  returnRate: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model("RecommendationPost", RecommendationPostSchema);
