// models/GamePost.js
import mongoose from "mongoose";

const gamePostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    isHeavyGame: { type: Boolean, default: false },
    gameZipKey: { type: String, required: true }, // S3 key
    coverImageKey: { type: String, required: true }, // S3 key
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional
  },
  { timestamps: true }
);

export default mongoose.model("GamePost", gamePostSchema);
