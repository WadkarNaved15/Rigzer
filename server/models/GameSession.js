import mongoose from "mongoose";

const GameSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    gamePost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AllPost",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["starting", "running", "ending", "ended", "failed"],
      default: "starting",
      index: true,
    },

    phase: {
      type: String,
      enum: ["downloading", "launching", null],
      default: null,
      index: true,
    },

    instanceId: {
      type: String,
      index: true,
    },

    instanceIp: String,

    maxDurationSeconds: {
      type: Number,
      required: true,
    },

    startedAt: {
      type: Date,
      index: true,
    },

    endedAt: {
      type: Date,
      index: true,
    },

    expiresAt: {
      type: Date,
      index: true,
    },

    error: {
      type: String,
    },

    metadata: {
      gameVersion: String,
      platform: String,
      gpuRequired: Boolean,
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

// Compound indexes for efficient queries
GameSessionSchema.index({ user: 1, status: 1 });
GameSessionSchema.index({ status: 1, expiresAt: 1 });

GameSessionSchema.statics.findExpiredSessions = function () {
  return this.find({
    status: "running",
    expiresAt: { $lte: new Date() },
  });
};

export default mongoose.model("GameSession", GameSessionSchema);