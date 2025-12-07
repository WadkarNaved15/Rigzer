import mongoose from "mongoose";

const adSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    mediaUrl: { type: String, required: true },
    mediaType: { type: String, enum: ["image", "video"], required: true },
    logoUrl: { type: String, default: null },
    redirectUrl: { type: String, required: true },

    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: null },

    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.model("Ad", adSchema);
