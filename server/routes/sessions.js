import express from "express";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
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

// Configuration
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
 * Start a new game session
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

      // Check concurrent session limit
      const activeSessions = await GameSession.countDocuments({
        user: userId,
        status: { $in: ["starting", "running"] },
      });

      if (activeSessions >= CONFIG.MAX_CONCURRENT_SESSIONS) {
        return res.status(429).json({
          error: "Maximum concurrent sessions reached",
          limit: CONFIG.MAX_CONCURRENT_SESSIONS,
          active: activeSessions,
        });
      }

      // Get game post
      let post = await cacheService.getGamePost(gamePostId);

      if (!post) {
        post = await AllPost.findById(gamePostId).select("type gamePost").lean();

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

      // Determine session duration
      const maxDurationSeconds = calculateSessionDuration(game);

      // Determine cleanup policy
      const cleanupPolicy = determineCleanupPolicy(game);

      // Create session
      const session = await GameSession.create({
        user: userId,
        gamePost: gamePostId,
        status: "starting",
        phase: null,
        maxDurationSeconds,
        metadata: {
          gameVersion: game.version,
          platform: game.platform,
          gpuRequired: game.systemRequirements?.gpuRequired || false,
        },
      });

      // Assign instance with retry
      let instance;
      for (let attempt = 0; attempt < CONFIG.RETRY_ATTEMPTS; attempt++) {
        try {
          instance = await assignOrStartInstance({
            gpuRequired: game.systemRequirements?.gpuRequired,
            ramGB: game.systemRequirements?.ramGB,
            cpuCores: game.systemRequirements?.cpuCores,
            timeout: CONFIG.INSTANCE_TIMEOUT,
          });
          break;
        } catch (err) {
          if (attempt < CONFIG.RETRY_ATTEMPTS - 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * (attempt + 1))
            );
          }
        }
      }

      if (!instance) {
        await session.updateOne({
          status: "failed",
          error: "No instances available",
        });
        metrics.recordFailure("instance_allocation", userId);

        return res.status(503).json({
          error: "No instances available",
          message: "Please try again in a few moments",
          retryAfter: 30,
        });
      }

      // Generate viewer token
      const viewerToken = jwt.sign(
        {
          sessionId: session._id.toString(),
          userId,
          gamePostId,
          iat: Math.floor(Date.now() / 1000),
        },
        process.env.STREAM_SECRET,
        { expiresIn: maxDurationSeconds }
      );

      const s3Url = `${process.env.GAME_S3_URL}/${game.file.url.replace(
        /^\/+/,
        ""
      )}`;

      console.log("s3_url", s3Url);

      // Build controller payload with cleanup policy
      const controllerPayload = {
        session_id: session._id.toString(),
        game_id: game.gameName,
        build_id: game.file.name,
        s3_url: s3Url,
        format: game.file.format,
        start_path: game.startPath,
        max_duration_seconds: maxDurationSeconds,
        backend_api_url: process.env.BACKEND_PUBLIC_URL,
        backend_api_key: process.env.INSTANCE_BACKEND_KEY,

        // ✅ Cleanup policy from backend
        cleanup_on_normal_exit: cleanupPolicy.on_normal_exit,
        cleanup_on_violation: cleanupPolicy.on_violation,
        cleanup_on_timeout: cleanupPolicy.on_timeout,
        delete_game_files: cleanupPolicy.delete_game_files,
        shared_build: cleanupPolicy.shared_build,
      };

      // Fire-and-forget controller start
      fetch(`http://${instance.ip}:4443/start-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": session._id.toString(),
        },
        body: JSON.stringify(controllerPayload),
      })
        .then(() => {
          console.log(
            "[Session] Controller start triggered:",
            session._id.toString()
          );
        })
        .catch((err) => {
          console.error("[Session] Controller start failed:", err);

          GameSession.findByIdAndUpdate(session._id, {
            status: "failed",
            error: "Controller start failed",
          }).catch(() => {});
        });

      // Update session with instance info and expiration
      const now = new Date();
      const expiresAt = new Date(now.getTime() + maxDurationSeconds * 1000);

      await session.updateOne({
        instanceId: instance.id,
        instanceIp: instance.ip,
        expiresAt,
      });

      // Cache active session
      await cacheService.setActiveSession(session._id.toString(), {
        userId,
        instanceId: instance.id,
        expiresAt,
      });

      // Record metrics
      metrics.recordSessionStart(userId, gamePostId, instance.id);

      // Return response
      return res.status(201).json({
        sessionId: session._id,
        status: "starting",
        phase: null,
        viewerToken,
        maxDurationSeconds,
        instanceRegion: instance.region,
      });
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
 * Get current session status
 */
router.get("/status/:sessionId", verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const cached = await cacheService.getActiveSession(sessionId);

    if (cached && cached.userId !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const session = await GameSession.findById(sessionId)
      .select("user status phase startedAt expiresAt maxDurationSeconds")
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
 * POST /api/sessions/end/:sessionId
 * Manually end a session
 */
router.post("/end/:sessionId", verifyToken, async (req, res) => {
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

    if (session.status === "ended") {
      return res.status(400).json({ error: "Session already ended" });
    }

    // Request controller to stop (it will handle cleanup)
    if (session.instanceIp) {
      try {
        await fetch(`http://${session.instanceIp}:4443/stop-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
          timeout: 5000,
        }).catch(() => {});
      } catch (err) {
        console.warn("Failed to notify controller:", err);
      }
    }

    // Mark as ending (controller will notify us when done)
    session.status = "ending";
    await session.save();


    return res.json({
      message: "Session stop requested",
      sessionId,
      status: "ending",
    });
  } catch (err) {
    console.error("Session end error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/sessions/:sessionId/events
 * SSE stream for session status updates
 */
router.get("/:sessionId/events", verifyToken, async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.id;

  const session = await GameSession.findById(sessionId)
    .select("user status phase")
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
  });

  sessionStreams.set(sessionId, send);

  req.on("close", () => {
    sessionStreams.delete(sessionId);
  });
});

/**
 * GET /api/sessions/:sessionId/stream-token
 */
router.get("/:sessionId/stream-token", verifyToken, async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.id;

  const session = await GameSession.findById(sessionId)
    .select("user status instanceIp")
    .lean();

  if (!session || session.user.toString() !== userId) {
    return res.sendStatus(403);
  }

  if (session.status !== "running") {
    return res.status(400).json({ error: "Session not ready" });
  }

  res.json({
    streamUrl: "https://stream.rigzer.com",
  });
});

/**
 * POST /api/sessions/complete
 * FINAL authoritative session completion (from supervisor)
 */
router.post("/complete", async (req, res) => {
  const {
    session_id,
    exit_reason,
    exit_code,
    duration_seconds,
    game_exit_code,
  } = req.body;

  const session = await GameSession.findById(session_id);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  // 🔑 THIS is the only place session becomes ended
  session.status = "ended";
  session.endedAt = new Date();
  session.exitReason = exit_reason;
  session.exitCode = exit_code;

  await session.save();

  // Notify SSE listeners
  const send = sessionStreams.get(session_id);
  if (send) {
    send({
      status: "ended",
      reason: exit_reason,
    });
  }

  // Metrics here (ONLY HERE)
  metrics.recordSessionEnd(session.user.toString(), session_id);

  res.json({ success: true });
});


/**
 * Calculate session duration based on game pricing
 */
function calculateSessionDuration(game) {
  if (game.price === 0) {
    return CONFIG.FREE_GAME_DURATION;
  }

  if (game.price > 0) {
    return CONFIG.PAID_GAME_DURATION;
  }

  return CONFIG.DEFAULT_DURATION;
}

/**
 * Determine cleanup policy based on game characteristics
 */
function determineCleanupPolicy(game) {
  const isLargeGame = game.file?.size > 1024 * 1024 * 1024; // > 1GB

  return {
    on_normal_exit: true,
    on_violation: true,
    on_timeout: true,
    delete_game_files: isLargeGame,
    shared_build: false,
  };
}

export default router;