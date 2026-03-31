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

    // ✅ CORE STATUS - Used by both queue and direct allocation
    status: {
      type: String,
      enum: [
        "waiting",              // ✅ In queue
        "allocation_ready",     // ✅ Instance allocated, waiting for user to launch
        "assigning",            // ✅ (legacy, can remove)
        "starting",             // ✅ Launching game (showing ads)
        "running",              // ✅ Stream active
        "ending",               // ✅ User exiting
        "ended",                // ✅ Session complete
        "failed",               // ✅ Error occurred
      ],
      default: "waiting",
      index: true,
    },

    // ✅ PHASE - Sub-state during starting
    phase: {
      type: String,
      enum: [
        "countdown",            // ✅ Waiting for user in countdown modal
        "downloading",          // ✅ Downloading game files
        "launching",            // ✅ Launching game
        null
      ],
      default: null,
      index: true,
    },

    // ✅ INSTANCE ALLOCATION
    instanceId: {
      type: String,
      index: true,
    },

    instanceIp: String,

    maxDurationSeconds: {
      type: Number,
      required: true,
    },

    // ✅ TIMESTAMPS
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

    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // ✅ ERROR TRACKING
    error: {
      type: String,
    },

    // ✅ LEASE MANAGEMENT
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

    // ✅ COUNTDOWN MODAL FIELDS
    countdownStartsAt: {
      type: Date,
      default: null,
      // This is when the countdown timer should appear
      // Used to sync client-side countdown with server time
    },

    countdownSeconds: {
      type: Number,
      default: 30,
      // How many seconds until instance auto-releases
    },

    // ✅ REGION (optional)
    instanceRegion: {
      type: String,
    },

    // ✅ EXIT TRACKING
    exitReason: {
      type: String,
      enum: [
        "user_exit",            // User closed stream
        "timeout",              // Session expired
        "disconnect",           // Connection lost
        "spot_interrupt",       // AWS spot instance interrupted
        "crash",                // Instance crashed
        "error",                // Generic error
        "user_abandoned",       // User closed browser before launch
        "countdown_expired",    // ✅ NEW: User didn't click launch in time
        "user_cancelled",       // ✅ NEW: User clicked cancel in modal
        "stale_abandoned",      // Cleanup job found abandoned session
      ],
    },

    exitCode: {
      type: Number,
    },

    // ✅ HEARTBEAT - Detect abandoned sessions
    lastHeartbeat: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // ✅ METADATA
    metadata: {
      gameVersion: String,
      platform: String,
      gpuRequired: Boolean,
    },

    // ✅ METRICS
    metrics: {
      totalPlayTime: {
        type: Number,
        default: 0,
      },
    },
  },
  { 
    timestamps: true,
    // createdAt added by timestamps
  }
);

// ✅ COMPOUND INDEXES FOR PERFORMANCE
GameSessionSchema.index({ user: 1, status: 1 });
GameSessionSchema.index({ status: 1, expiresAt: 1 });
GameSessionSchema.index({ status: 1, lastHeartbeat: 1 });
GameSessionSchema.index({ status: 1, createdAt: 1 }); // ✅ NEW: For FIFO queue
GameSessionSchema.index({ createdAt: 1, status: 1 }); // ✅ NEW: For age detection

// ✅ STATICS - Helper methods
GameSessionSchema.statics.findExpiredSessions = function () {
  return this.find({
    status: "running",
    expiresAt: { $lte: new Date() },
  });
};

// ✅ NEW: Find sessions in countdown that expired
GameSessionSchema.statics.findExpiredCountdowns = function () {
  return this.find({
    status: "allocation_ready",
    countdownStartsAt: { $lte: new Date(Date.now() - 35000) }, // 35s (30s + 5s buffer)
  });
};

// ✅ NEW: Find abandoned sessions (no heartbeat for 60s)
GameSessionSchema.statics.findAbandonedSessions = function () {
  const cutoff = new Date(Date.now() - 60000); // 60 seconds ago
  return this.find({
    status: { $in: ["waiting", "allocation_ready", "starting"] },
    lastHeartbeat: { $lt: cutoff },
  });
};

// ✅ NEW: Find next queued session (FIFO)
GameSessionSchema.statics.findNextQueued = function () {
  return this.findOne({
    status: "waiting",
    leasing: false,
  }).sort({ createdAt: 1 });
};

export default mongoose.model("GameSession", GameSessionSchema);