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
      // ✅ Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const userId = req.user.id;
      const { gamePostId } = req.body;

      // ✅ Concurrent session check
      const activeSessions = await GameSession.countDocuments({
        user: userId,
        status: { $in: ["waiting", "starting", "running"] },
      });

      if (activeSessions >= CONFIG.MAX_CONCURRENT_SESSIONS) {
        return res.status(429).json({
          error: "Maximum concurrent sessions reached",
          limit: CONFIG.MAX_CONCURRENT_SESSIONS,
          active: activeSessions,
        });
      }

      // ✅ Get game post with cache + validation
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
      const cleanupPolicy = determineCleanupPolicy(game);

      // ✅ Create session with metadata
      const session = await GameSession.create({
        user: userId,
        gamePost: gamePostId,
        status: "waiting",
        phase: null,
        maxDurationSeconds,
        metadata: {
          gameVersion: game.version,
          platform: game.platform,
          gpuRequired: game.systemRequirements?.gpuRequired || false,
        },
      });

      // ✅ Respond immediately
      res.status(202).json({
        sessionId: session._id,
        status: "waiting",
      });

      // ✅ Allocate after response
      setImmediate(async () => {
        try {
          const lease = await assignOrStartInstance({});

          if (!lease?.id) {
            // ASG scaling — worker will call /api/internal/instance-ready
            console.log(`[Session] ASG scaling for session ${session._id}`);
            return;
          }

          const s3Url = `${process.env.GAME_S3_URL}/${game.file.url.replace(/^\/+/, "")}`;

          console.log("s3_url", s3Url);

          await GameSession.findByIdAndUpdate(session._id, {
            instanceId: lease.id,
            instanceIp: lease.ip,
            leaseToken: lease.leaseToken,
            status: "starting",
            leasing: false,
            expiresAt: new Date(Date.now() + maxDurationSeconds * 1000),
          });

          // ✅ Cache active session
          await cacheService.setActiveSession(session._id.toString(), {
            userId,
            instanceId: lease.id,
            expiresAt: new Date(Date.now() + maxDurationSeconds * 1000),
          });

          const send = sessionStreams.get(session._id.toString());
          if (send) send({ status: "starting" });

          // ✅ Record metrics
          metrics.recordSessionStart(userId, gamePostId, lease.id);

          // ✅ Send full payload to controller
          fetch(`http://${lease.ip}:4443/start-session`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Session-Id": session._id.toString(),
            },
            body: JSON.stringify({
              session_id: session._id.toString(),
              game_id: game.gameName,
              build_id: game.file.name,
              s3_url: s3Url,
              format: game.file.format,
              start_path: game.startPath,
              max_duration_seconds: maxDurationSeconds,
              backend_api_url: process.env.BACKEND_PUBLIC_URL,
              backend_api_key: process.env.INSTANCE_BACKEND_KEY,
              cleanup_on_normal_exit: cleanupPolicy.on_normal_exit,
              cleanup_on_violation: cleanupPolicy.on_violation,
              cleanup_on_timeout: cleanupPolicy.on_timeout,
              delete_game_files: cleanupPolicy.delete_game_files,
              shared_build: cleanupPolicy.shared_build,
            }),
          })
            .then(() => {
              console.log("[Session] Controller start triggered:", session._id.toString());
            })
            .catch((err) => {
              console.error("[Session] Controller start failed:", err);
              GameSession.findByIdAndUpdate(session._id, {
                status: "failed",
                exitReason: "error",
              }).catch(() => {});
            });

        } catch (err) {
          console.error(`[Session] Allocation error for ${session._id}:`, err);
          metrics.recordFailure("instance_allocation", userId);
          await GameSession.findByIdAndUpdate(session._id, {
            status: "failed",
            exitReason: "error",
          });
          const send = sessionStreams.get(session._id.toString());
          if (send) send({ status: "failed" });
        }
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

    if (session.instanceIp) {
      fetch(`http://${session.instanceIp}:4443/stop-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      }).catch(() => {});
    }

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
 * SSE stream
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

  send({ status: session.status, phase: session.phase });

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

  const session = await GameSession.findById(sessionId).lean();

  if (!session) return res.sendStatus(404);
  if (session.user.toString() !== userId) return res.sendStatus(403);
  if (session.status !== "running") {
    return res.status(400).json({ error: "Session not ready" });
  }

  // ✅ JWT token — not hardcoded URL
  const token = jwt.sign(
    { sessionId, userId },
    process.env.STREAM_SECRET,
    { expiresIn: "2m" }
  );

  res.json({
    streamUrl: `https://stream.rigzer.com/api/stream/${token}`,
  });
});

/**
 * POST /api/sessions/:sessionId/heartbeat
 */
router.post("/:sessionId/heartbeat", verifyToken, async (req, res) => {
  await GameSession.findOneAndUpdate(
    { _id: req.params.sessionId, user: req.user.id },
    { lastHeartbeat: new Date() }
  );
  res.sendStatus(200);
});

/**
 * POST /api/sessions/:sessionId/abandon/:secret
 */
router.post("/:sessionId/abandon/:secret", async (req, res) => {
  if (req.params.secret !== process.env.ABANDON_SECRET) {
    return res.sendStatus(401);
  }

  const { sessionId } = req.params;
  const session = await GameSession.findById(sessionId);

  if (!session || session.status === "ended") return res.sendStatus(200);

  if (session.instanceIp) {
    fetch(`http://${session.instanceIp}:4443/stop-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    }).catch(() => {});
  }

  session.status = "ended";
  session.endedAt = new Date();
  session.exitReason = "user_abandoned";
  await session.save();

  await releaseInstance(session.instanceId, session.leaseToken).catch(() => {});

  res.sendStatus(200);
});

/**
 * POST /api/sessions/running
 * Called by internal when session becomes running
 */
router.post("/running", async (req, res) => {
  const { session_id } = req.body;

  const session = await GameSession.findById(session_id);
  if (!session) return res.sendStatus(404);

  session.status = "running";
  session.startedAt = new Date();
  await session.save();

  // ✅ Set stream cache so streamProxy can resolve instanceIp
  await cacheService.set(
    `stream:${session_id}`,
    {
      instanceIp: session.instanceIp,
      userId: session.user.toString(),
    },
    3600
  );

  const send = sessionStreams.get(session_id);
  if (send) send({ status: "running" });

  res.json({ success: true });
});

/**
 * POST /api/sessions/complete
 * Called by supervisor when session ends
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

  // 🔑 Only place session becomes ended
  session.status = "ended";
  session.endedAt = new Date();
  session.exitReason = exit_reason;
  session.exitCode = exit_code;
  await session.save();

  // ✅ Release instance
  await releaseInstance(session.instanceId, session.leaseToken);

  const send = sessionStreams.get(session_id);
  if (send) send({ status: "ended", reason: exit_reason });

  metrics.recordSessionEnd(session.user.toString(), session_id);

  res.json({ success: true });
});

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