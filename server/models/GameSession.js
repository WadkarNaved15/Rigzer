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
      enum: [
        "waiting",
        "assigning",
        "starting",
        "running",
        "ending",
        "ended",
        "failed",
      ],
      default: "waiting",
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

    leasing: {
      type: Boolean,
      default: false,
      index: true,
    },

    lastAllocationAttempt: {
      type: Date,
      default: null,
    },

    leaseToken: {
      type: String,
      index: true,
    },

    leaseExpiresAt: {
      type: Date,
      index: true,
    },

    instanceRegion: {
      type: String,
    },

    // ✅ renamed from endedReason → exitReason to match sessions.js usage
    exitReason: {
      type: String,
      enum: [
        "user_exit",
        "timeout",
        "disconnect",
        "spot_interrupt",
        "crash",
        "error",
        "user_abandoned",  // ✅ added for abandon endpoint
        "stale_abandoned", // ✅ added for cleanup job
      ],
    },

    // ✅ added — used in /complete endpoint
    exitCode: {
      type: Number,
    },

    // ✅ added — heartbeat from frontend to detect abandoned sessions
    lastHeartbeat: {
      type: Date,
      default: Date.now,
      index: true,
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
GameSessionSchema.index({ status: 1, lastHeartbeat: 1 }); // ✅ added for stale cleanup query

GameSessionSchema.statics.findExpiredSessions = function () {
  return this.find({
    status: "running",
    expiresAt: { $lte: new Date() },
  });
};

export default mongoose.model("GameSession", GameSessionSchema);