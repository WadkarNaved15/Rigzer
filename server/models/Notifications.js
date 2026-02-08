import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      required: true, // LIKE, COMMENT, FOLLOW
    },

    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AllPost",
      default: null,
    },

    // ✅ Only store last 3 actors
    actorsPreview: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // ✅ Total number of actions
    count: {
      type: Number,
      default: 1,
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
