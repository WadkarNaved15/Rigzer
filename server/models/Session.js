import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  deviceId: {
    type: String,
    required: true
  },
  tokenHash: {
    type: String,
    required: true
  },
  userAgent: String,
  ip: String,
  lastUsed: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });
sessionSchema.index({ userId: 1, deviceId: 1 });
sessionSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 } // 30 days
);

export default mongoose.model("Session", sessionSchema);
