import mongoose from "mongoose";

const LikeSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: "AllPost", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now }
});
LikeSchema.index({ post: 1, user: 1 }, { unique: true });
LikeSchema.index({ post: 1 }); // for faster counts
LikeSchema.index({ user: 1 }); // for user activity queries
export default mongoose.model("Like", LikeSchema);
