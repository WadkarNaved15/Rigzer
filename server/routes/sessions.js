import express from "express";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import crypto from "crypto";
import { body, validationResult } from "express-validator";

import AllPost from "../models/Allposts.js";
import GameSession from "../models/GameSession.js";
import {
  assignOrStartInstance,
  releaseInstance,
} from "../services/instanceAllocator.js";
import verifyToken from "../middlewares/authMiddleware.js";
import cacheService from "../services/cacheService.js";
import { SessionMetrics } from "../services/sessionMetrics.js";
import { sessionStreams } from "../services/sessionStream.js";

const router = express.Router();
const metrics = new SessionMetrics();

const CONFIG = {
  DEFAULT_DURATION: 600,
  FREE_GAME_DURATION: 1800,
  PAID_GAME_DURATION: 3600,
  MAX_CONCURRENT_SESSIONS: 3,
  INSTANCE_TIMEOUT: 10000,
  RETRY_ATTEMPTS: 2,
};

/**
 * POST /api/sessions/start
 * ✅ Updated: Returns 202 immediately (queued or direct)
 * Allocation happens asynchronously via instance-ready callback
 */
/**
 * POST /api/sessions/start
 * ✅ FIXED: Queue ONLY when ASG at max
 *           Skip queue when ASG is scaling
 */
router.post(
  "/start",
  verifyToken,
  [body("gamePostId").isMongoId().withMessage("Invalid gamePostId format")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const userId = req.user.id;
      const { gamePostId } = req.body;

      // ✅ Check concurrent session limit
      const activeSessions = await GameSession.countDocuments({
        user: userId,
        status: { $in: ["waiting", "allocation_ready", "starting", "running"] },
      });

      if (activeSessions) {
        return res.status(429).json({
          error: "Maximum concurrent sessions reached",
          active: activeSessions,
        });
      }

      // ✅ Get game post
      let post = await cacheService.getGamePost(gamePostId);

      if (!post) {
        post = await AllPost.findById(gamePostId)
          .select("type gamePost")
          .lean();

        if (!post || post.type !== "game_post" || !post.gamePost) {
          return res.status(404).json({ error: "Game not found" });
        }

        if (!post.gamePost.file?.url || !post.gamePost.startPath) {
          return res.status(400).json({
            error: "Game configuration incomplete",
          });
        }

        await cacheService.setGamePost(gamePostId, post);
      }

      const game = post.gamePost;
      const maxDurationSeconds = calculateSessionDuration(game);

      let queueType = "direct";
      // ✅ Try to allocate instance
      let response202 = {
        status: "waiting",
      };

      try {
        
        const leaseResult = await assignOrStartInstance({});

        // ✅ CASE 1: Got instance immediately
        if (leaseResult && !leaseResult.scaling && !leaseResult.queued) {
          console.log(`[Session Start] Got instance immediately`);
          // This is direct play - shouldn't happen in this flow
        }
        // ✅ CASE 2: ASG at max → User QUEUES
        else if (leaseResult && leaseResult.queued) {
          console.log(`[Session Start] User will be queued:`, {
            position: leaseResult.queuePosition,
            total: leaseResult.totalQueued,
            wait: leaseResult.estimatedWaitMinutes
          });
          queueType = "queued";
          
          // Include queue info in response
          response202.queuePosition = leaseResult.queuePosition;
          response202.totalQueued = leaseResult.totalQueued;
          response202.estimatedWaitMinutes = leaseResult.estimatedWaitMinutes;
          response202.avgSessionDuration = leaseResult.avgSessionDuration;
        }
        // ✅ CASE 3: ASG scaling → Skip queue, go to ads
        else if (leaseResult && leaseResult.scaling) {
          console.log(`[Session Start] ASG scaling - user skips queue, goes to ads`);
          // ✅ NO queue info - user skips queue notification
          // Frontend will show loading spinner, then ads
        }
      } catch (err) {
        console.error("[Session Start] Allocation check error (non-fatal):", err.message);
        // Don't fail - allocation will happen via instance-ready callback
      }

        // ✅ Create session in WAITING state
      const session = await GameSession.create({
        user: userId,
        gamePost: gamePostId,
        status: "waiting",
        phase: null,
        maxDurationSeconds,
        queueType,
        metadata: {
          gameVersion: game.version,
          platform: game.platform,
          gpuRequired: game.systemRequirements?.gpuRequired || false,
        },
      });
      response202.sessionId = session._id;

// SSE initial event
const send = sessionStreams.get(session._id.toString());
if (send) {
  send({
    status: "waiting",
    phase: null
  });
}

console.log(`[Session Start] Returning 202`, response202);


      res.status(202).json(response202);
      // Note: Allocation continues asynchronously via instance-ready callback

    } catch (err) {
      console.error("Session start error:", err);
      metrics.recordFailure("unknown", req.user?.id);
      return res.status(500).json({
        error: "Internal server error",
        message: "An unexpected error occurred",
      });
    }
  }
);
 
/**
 * GET /api/sessions/status/:sessionId
 * ✅ Returns current session status including queue info
 */
router.get("/status/:sessionId", verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
 
    const session = await GameSession.findById(sessionId)
      .select(
        "user status phase countdownStartsAt countdownSeconds startedAt expiresAt maxDurationSeconds"
      )
      .lean();
 
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
 
    if (session.user.toString() !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }
 
    const now = Date.now();
    const remainingSeconds = session.expiresAt
      ? Math.max(0, Math.floor((new Date(session.expiresAt) - now) / 1000))
      : session.maxDurationSeconds;
 
    return res.json({
      sessionId,
      status: session.status,
      phase: session.phase,
      countdownStartsAt: session.countdownStartsAt,
      countdownSeconds: session.countdownSeconds,
      remainingSeconds,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
    });
  } catch (err) {
    console.error("Session status error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
 
/**
 * GET /api/sessions/:sessionId/events
 * ✅ SSE stream for real-time updates
 */
router.get("/:sessionId/events", verifyToken, async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.id;
 
  const session = await GameSession.findById(sessionId)
    .select("user status phase countdownStartsAt")
    .lean();
 
  if (!session || session.user.toString() !== userId) {
    return res.sendStatus(403);
  }
 
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
 
  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
 
  // Send initial state
  send({
    status: session.status,
    phase: session.phase,
    countdownStartsAt: session.countdownStartsAt,
  });
 
  sessionStreams.set(sessionId.toString(), send);
 
  req.on("close", () => {
    sessionStreams.delete(sessionId.toString());
  });
});
 


/**
 * GET /api/sessions/:sessionId/stream-token
 * ✅ Get secure stream URL (only for running sessions)
 */
router.get("/:sessionId/stream-token", verifyToken, async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.id;

  const session = await GameSession.findById(sessionId).lean();
  if (!session) return res.sendStatus(404);
  if (session.user.toString() !== userId) return res.sendStatus(403);
  if (session.status !== "running") {
    return res.status(400).json({ error: "Session not ready" });
  }

  const streamToken = await cacheService.get(`streamtoken:${sessionId}`);
  if (!streamToken) {
    return res.status(400).json({ error: "Stream token not available yet" });
  }

  res.json({
    streamUrl: `https://${streamToken}.stream.rigzer.com`,
  });
});

/**
 * POST /api/sessions/:sessionId/heartbeat
 * ✅ Frontend sends every 10s to prove user is alive
 */
router.post("/:sessionId/heartbeat", verifyToken, async (req, res) => {
  try {
    await GameSession.findOneAndUpdate(
      { _id: req.params.sessionId, user: req.user.id },
      { lastHeartbeat: new Date() }
    );
    res.sendStatus(200);
  } catch (err) {
    console.error("Heartbeat error:", err);
    res.sendStatus(500);
  }
});

/**
 * POST /api/sessions/:sessionId/cancel
 * ✅ NEW: User cancels before launch (queued or countdown)
 */
/**
 * POST /api/sessions/:sessionId/cancel
 * ✅ User cancels before launch (queued or countdown)
 */
router.post("/:sessionId/cancel", verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
 
    const session = await GameSession.findById(sessionId);
 
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
 
    if (session.user.toString() !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }
 
    // ✅ Can cancel from waiting or allocation_ready
    if (!["waiting", "allocation_ready"].includes(session.status)) {
      return res.status(400).json({
        error: `Cannot cancel from status ${session.status}`,
      });
    }
 
    // ✅ Release instance if allocated
    if (session.instanceId && session.leaseToken) {
      try {
        const releaseResult = await releaseInstance(
          session.instanceId,
          session.leaseToken
        );
        console.log("[Cancel] Release result:", releaseResult);
      } catch (err) {
        console.error("[Cancel] Error releasing instance:", err.message);
        // Don't fail cancel if release fails
      }
    }
 
    // ✅ Mark as ended
    const reason =
      session.status === "allocation_ready"
        ? "user_cancelled" // User cancelled from countdown modal
        : "user_abandoned"; // User cancelled from queue
 
    const updates = {
      status: "ended",
      endedAt: new Date(),
      exitReason: reason,
    };
 
    await GameSession.findByIdAndUpdate(sessionId, updates);
 
    // ✅ Notify SSE
    const send = sessionStreams.get(sessionId.toString());
    if (send) send({ status: "ended", reason });
 
    return res.json({ message: "Session cancelled", sessionId });
  } catch (err) {
    console.error("Session cancel error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/sessions/:sessionId/abandon/:secret
 * ✅ Beacon endpoint - user closed tab
 */
router.post("/:sessionId/abandon/:secret", async (req, res) => {
  if (req.params.secret !== process.env.ABANDON_SECRET) {
    return res.sendStatus(401);
  }

  const { sessionId } = req.params;

  try {
    const session = await GameSession.findById(sessionId);

    if (!session || session.status === "ended") {
      return res.sendStatus(200);
    }

    // ✅ Release instance if allocated
    if (session.instanceId && session.leaseToken) {
      try {
        await releaseInstance(session.instanceId, session.leaseToken);
      } catch (err) {
        console.error("Error releasing instance:", err);
      }
    }

    // ✅ Mark as abandoned
    const updates = {
      status: "ended",
      endedAt: new Date(),
      exitReason: "user_abandoned",
    };

    await GameSession.findByIdAndUpdate(sessionId, updates);

    console.log(`[Abandon] Session ${sessionId} abandoned by user`);
    return res.sendStatus(200);
  } catch (err) {
    console.error("Abandon error:", err);
    return res.sendStatus(500);
  }
});

/**
 * GET /api/sessions/:sessionId/stream-token
 * (Duplicate? Already defined above - this should be removed)
 * Keeping for reference
 */

/**
 * POST /api/sessions/running
 * ✅ Called by instance when stream starts (for metrics)
 * NOTE: Actual status change happens in /sessions/update
 */
router.post("/running", async (req, res) => {
  const { session_id } = req.body;

  try {
    const session = await GameSession.findById(session_id);
    if (!session) return res.sendStatus(404);

    // Stream token already generated in /sessions/update
    // Just log for metrics
    console.log(`[Running] Session ${session_id} is now streaming`);

    res.json({ success: true });
  } catch (err) {
    console.error("[Running] Error:", err);
    res.sendStatus(500);
  }
});

/**
 * POST /api/sessions/complete
 * ✅ Called when session ends (by supervisor/controller)
 */
router.post("/complete", async (req, res) => {
  try {
    const {
      session_id,
      exit_reason,
      exit_code,
      duration_seconds,
    } = req.body;

    const session = await GameSession.findById(session_id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // ✅ Only mark as ended if not already
    if (session.status !== "ended") {
      const updates = {
        status: "ended",
        endedAt: new Date(),
        exitReason: exit_reason || "user_exit",
        exitCode: exit_code,
      };

      await GameSession.findByIdAndUpdate(session_id, updates);

      // Release instance
      if (session.instanceId && session.leaseToken) {
        try {
          await releaseInstance(session.instanceId, session.leaseToken);
        } catch (err) {
          console.error("Error releasing instance:", err);
        }
      }

      // Notify SSE
      const send = sessionStreams.get(session_id.toString());
      if (send) send({ status: "ended", reason: exit_reason });

      metrics.recordSessionEnd(session.user.toString(), session_id);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Session complete error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ================= HELPERS ================= */

function calculateSessionDuration(game) {
  if (game.price === 0) return CONFIG.FREE_GAME_DURATION;
  if (game.price > 0) return CONFIG.PAID_GAME_DURATION;
  return CONFIG.DEFAULT_DURATION;
}

function determineCleanupPolicy(game) {
  const isLargeGame = game.file?.size > 1024 * 1024 * 1024;
  return {
    on_normal_exit: true,
    on_violation: true,
    on_timeout: true,
    delete_game_files: isLargeGame,
    shared_build: false,
  };
}

export default router;