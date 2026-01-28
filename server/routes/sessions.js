import express from "express";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import { body, validationResult } from "express-validator";

import AllPost from "../models/Allposts.js";
import GameSession from "../models/GameSession.js";
import { assignOrStartInstance , releaseInstance} from "../services/instanceAllocator.js";
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
 * Start a new game session with comprehensive validation and error handling
 */
router.post(
  "/start",
  verifyToken,
  [
    body("gamePostId")
      .isMongoId()
      .withMessage("Invalid gamePostId format"),
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: errors.array() 
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
          active: activeSessions
        });
      }

      // Try cache first for game post
      let post = await cacheService.getGamePost(gamePostId);
      
      if (!post) {
        post = await AllPost.findById(gamePostId)
          .select("type gamePost")
          .lean();
        
        if (!post || post.type !== "game_post" || !post.gamePost) {
          return res.status(404).json({ error: "Game not found" });
        }

        // Validate game post structure
        if (!post.gamePost.file?.url || !post.gamePost.startPath) {
          return res.status(400).json({ 
            error: "Game configuration incomplete" 
          });
        }

        await cacheService.setGamePost(gamePostId, post);
      }

      const game = post.gamePost;

      // Determine session duration with better logic
      const maxDurationSeconds = calculateSessionDuration(game);

      // Create optimized session record
      const session = await GameSession.create({
        user: userId,
        gamePost: gamePostId,
        status: "starting",
        maxDurationSeconds,
        metadata: {
          gameVersion: game.version,
          platform: game.platform,
          gpuRequired: game.systemRequirements?.gpuRequired || false,
        },
      });

      // Assign instance with retry logic
      let instance;
      let lastError;
      
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
          lastError = err;
          if (attempt < CONFIG.RETRY_ATTEMPTS - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          }
        }
      }

      if (!instance) {
        await session.updateOne({ status: "failed" });
        metrics.recordFailure("instance_allocation", userId);
        
        return res.status(503).json({ 
          error: "No instances available",
          message: "Please try again in a few moments",
          retryAfter: 30
        });
      }

      // Generate secure viewer token
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

      
const s3Url = `${process.env.GAME_S3_URL}/${game.file.url.replace(/^\/+/, "")}`

console.log("s3_url",s3Url);

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
};


      // Call instance controller with timeout
// ✅ ASYNC FIRE-AND-FORGET
fetch(`http://${instance.ip}:4443/start-session`, {
  method: "POST",
  headers: { 
    "Content-Type": "application/json",
    "X-Session-Id": session._id.toString(),
  },
  body: JSON.stringify(controllerPayload),
})
  .then(() => {
    console.log("[Session] Controller start triggered:", session._id.toString());
  })
  .catch(err => {
    console.error("[Session] Controller start failed:", err);

    // mark failed asynchronously
    GameSession.findByIdAndUpdate(session._id, {
      status: "failed",
    }).catch(() => {});
  });

      // Update session to running state
await session.updateOne({
  instanceId: instance.id,
  instanceIp: instance.ip,
});


      const now = new Date();
      // Cache active session
      await cacheService.setActiveSession(session._id.toString(), {
        userId,
        instanceId: instance.id,
        expiresAt: new Date(now.getTime() + maxDurationSeconds * 1000),
      });

      // Record metrics
      metrics.recordSessionStart(userId, gamePostId, instance.id);

      // Return response
return res.status(201).json({
  sessionId: session._id,
  status: "starting",
  viewerToken,
  maxDurationSeconds,
  instanceRegion: instance.region,
});

    } catch (err) {
      console.error("Session start error:", err);
      metrics.recordFailure("unknown", req.user?.id);
      
      return res.status(500).json({ 
        error: "Internal server error",
        message: "An unexpected error occurred"
      });
    }
  }
);

/**
 * GET /api/sessions/:sessionId/status
 * Get current session status
 */
router.get("/status/:sessionId", verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Check cache first
    const cached = await cacheService.getActiveSession(sessionId);
    
    if (cached && cached.userId !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

const session = await GameSession.findById(sessionId)
  .select("status phase startedAt expiresAt maxDurationSeconds")
  .lean();
;

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
  phase: session.phase,   // ✅ REQUIRED
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
 * POST /api/sessions/:sessionId/end
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

    // Notify instance to stop
    if (session.instanceIp) {
      try {
        await fetch(`http://${session.instanceIp}:4443/stop-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
          timeout: 5000,
        }).catch(() => {}); // Best effort
      } catch (err) {
        // Non-critical, continue
      }
    }
    await releaseInstance(session.instanceId);

    session.status = "ended";
    session.endedAt = new Date();
    await session.save();

    // Clear cache
    await cacheService.deleteActiveSession(sessionId);

    metrics.recordSessionEnd(userId, sessionId);

    return res.json({ 
      message: "Session ended successfully",
      sessionId 
    });

  } catch (err) {
    console.error("Session end error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});


// ✅ SSE — no ambiguity, no collisions
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
  res.setHeader("X-Accel-Buffering", "no"); // 🔥 important for nginx later

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // 🔥 send initial state
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

  console.log("sessionId , userId",sessionId , userId);

  const session = await GameSession.findById(sessionId)
    .select("user status instanceIp")
    .lean();

  if (!session || session.user.toString() !== userId) {
    return res.sendStatus(403);
  }

  if (session.status !== "running") {
    return res.status(400).json({ error: "Session not ready" });
  }

    // const token = jwt.sign(
    //   {
    //     sessionId,
    //     instanceIp: session.instanceIp,
    //     exp: Math.floor(Date.now() / 1000) + 60, // 🔐 60s
    //   },
    //   process.env.STREAM_SECRET
    // );

    // console.log("token",token);
    // res.json({
    //   streamUrl: `/api/stream/proxy/${token}`,
    // });
      // ✅ DIRECT INSTANCE URL (TEMP)
 res.json({
    streamUrl: "https://stream.rigzer.com",
  });
});


/**
 * Calculate session duration based on game pricing and user tier
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

export default router;