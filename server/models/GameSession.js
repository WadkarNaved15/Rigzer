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
    queueType: {
      type: String,
      enum: ["direct", "queued"],
      default: "direct"
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

    endingAt: {
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

    allocationExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },

    // ✅ REGION (optional)
    instanceRegion: {
      type: String,
    },

        // ============================================================
    // ALLOCATION TRACKING
    // ============================================================
    allocation: {
      type: {
        type: String,
        enum: ["idle", "scaling", "queued"],
        default: null,
      },

      // Unique ID for this scale-up allocation request.
      // Used to associate the newly-created EC2 with this session.
      requestId: {
        type: String,
        default: null,
        index: true,
      },

      // ASG instance IDs that existed when the scale-up started.
      // Used to discover the newly-created instance.
      baselineInstanceIds: {
        type: [String],
        default: [],
      },
    },

    storage: {
      status: {
        type: String,
        enum: [
          "pending",
          "creating",
          "attaching",
          "ready",
          "detaching",
          "deleted",
          "failed"
        ],
        default: "pending"
      },
      snapshotId: {
        type: String,
        default: null
      },
      volumeId: {
        type: String,
        default: null,
        index: true
      },
      deviceName: {
        type: String,
        default: null
      },
      availabilityZone: {
        type: String,
        default: null
      },
      attachedAt: {
        type: Date,
        default: null
      },
      readyAt: {
        type: Date,
        default: null
      },
      cleanupStartedAt: {
        type: Date,
        default: null,
      },

      cleanupLeaseExpiresAt: {
        type: Date,
        default: null,
      },
      error: {
        type: String,
        default: null
      }
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
        "countdown_expired",    // User didn't click launch in time
        "user_cancelled",       // User clicked cancel in modal
        "stale_abandoned",      // Cleanup job found abandoned session
        "credits_exhausted",    // Session ended due to credit exhaustion
        "allocation_timeout",
        "controller_error",
        "storage_error",
        "instance_error",
        "unknown"
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
    auditRecorded: {
      type: Boolean,
      default: false,
    },
    analyticsProcessed: {
      type: Boolean,
      default: false,
    },

    // ✅ METRICS
    metrics: {
      totalPlayTime: {
        type: Number,
        default: 0,
      },
    },

    //Feedback
    feedback: {
      submitted: {
        type: Boolean,
        default: false,
      },

      submittedAt: {
        type: Date,
        default: null,
      },

      feedbackPromptedAt: {
        type: Date,
        default: null,
        index: true,
      },
    },
    
    billing: {
      creditsConsumed: {
        type: Number,
        default: 0,
      },

      billedPlayTimeMs: {
        type: Number,
        default: 0,
      },
      processing: {
        type: Boolean,
        default: false,
      },
      lastBillingAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
    // createdAt added by timestamps
  }
);

// ==================== CORE / OPERATIONAL ====================

GameSessionSchema.index({
  status: 1,
  lastHeartbeat: 1,
});

GameSessionSchema.index({
  status: 1,
  expiresAt: 1,
});

GameSessionSchema.index({
  status: 1,
  allocationExpiresAt: 1,
});

GameSessionSchema.index({
  status: 1,
  leasing: 1,
  createdAt: 1,
});


// ==================== ADMIN / ANALYTICS ====================

GameSessionSchema.index({
  user: 1,
  createdAt: -1,
});

GameSessionSchema.index({
  gamePost: 1,
  status: 1,
  createdAt: -1,
});

GameSessionSchema.index({
  status: 1,
  startedAt: -1,
});

GameSessionSchema.index({
  status: 1,
  endingAt: 1,
});

GameSessionSchema.index({
  exitReason: 1,
  endedAt: -1,
});

GameSessionSchema.index({
  instanceRegion: 1,
  status: 1,
});


// ==================== BILLING ====================

GameSessionSchema.index({
  status: 1,
  "billing.processing": 1,
  "billing.lastBillingAt": 1,
});


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
    allocationExpiresAt: {
      $lte: new Date(),
    },
  });
};

// ✅ NEW: Find abandoned sessions (no heartbeat for 60s)
GameSessionSchema.statics.findAbandonedSessions = function () {
  const cutoff = new Date(Date.now() - 60000);

  return this.find({
    status: {
      $in: ["waiting", "starting"]
    },
    lastHeartbeat: {
      $lt: cutoff
    },
  });
};

// ✅ NEW: Find next queued session (FIFO)
GameSessionSchema.statics.findNextQueued = function () {
  return this.findOne({
    status: "waiting",
    queueType: "queued",
    "allocation.type": "queued",
    leasing: false,
  }).sort({ createdAt: 1 });
};


export default mongoose.model("GameSession", GameSessionSchema);