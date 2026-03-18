import mongoose from "mongoose";

const WishlistSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: "AllPost", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now }
});
WishlistSchema.index({ post: 1, user: 1 }, { unique: true });
export default mongoose.model("Wishlist", WishlistSchema);
