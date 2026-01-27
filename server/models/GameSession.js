import mongoose from "mongoose";

const GameSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // 🔥
    },

    gamePost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AllPost",
      required: true,
      index: true, // 🔥
    },

    status: {
      type: String,
      enum: ["starting", "running", "ended", "failed"],
      default: "starting",
      index: true, // 🔥 very important
    },
phase: {
  type: String,
  enum: ["downloading", "launching"],
  default: null,
  index: true,
},


    instanceId: {
      type: String,
      index: true, // 🔥
    },

    instanceIp: String,

    maxDurationSeconds: {
      type: Number,
      required: true,
    },

    startedAt: {
      type: Date,
      index: true, // 🔥
    },

    endedAt: {
      type: Date,
      index: true,
    },

    expiresAt: {
      type: Date,
      index: true, // 🔥 critical for cleanup
    },
    error: {
  type: String,
},


    metrics: {
      totalPlayTime: {
        type: Number,
        default: 0,
      },
    },
  },
  { timestamps: true }
);

GameSessionSchema.statics.findExpiredSessions = function () {
  return this.find({
    status: "running",
    expiresAt: { $lte: new Date() },
  });
};


export default mongoose.model("GameSession", GameSessionSchema);
