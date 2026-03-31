import express from "express";
import GameSession from "../models/GameSession.js";
import { publishSessionEvent } from "../services/sessionPubSub.js";
import { releaseInstance, assignOrStartInstance } from "../services/instanceAllocator.js";
import fetch from "node-fetch";
import { sessionStreams } from "../services/sessionStream.js";
import AllPost from "../models/Allposts.js";
import cacheService from "../services/cacheService.js";
import crypto from "crypto";

const router = express.Router();

const verifyInternalKey = (req, res, next) => {
  const key = req.headers.authorization?.replace("Bearer ", "");
  if (key !== process.env.INSTANCE_BACKEND_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

/**
 * POST /api/internal/instance-ready
 * Called by ASG when instance becomes available
 * ✅ Updated: Handles both queue and direct allocation
 */
router.post("/instance-ready", verifyInternalKey, async (req, res) => {
  const { workerId, instanceIp } = req.body;
  console.log("Instance ready callback:", { workerId, instanceIp });

  if (!workerId || !instanceIp) {
    return res.status(400).json({ error: "workerId and instanceIp required" });
  }

  log(`[Instance Ready] ${workerId} @ ${instanceIp}`);

  try {
    // ✅ STEP 1: Find next waiting session (FIFO - queued first)
    const session = await GameSession.findOneAndUpdate(
      { status: "waiting", leasing: false },
      { $set: { leasing: true, lastAllocationAttempt: new Date() } },
      { sort: { createdAt: 1 }, new: true }
    );

    if (!session) {
      log(`[Instance Ready] No waiting sessions, ${workerId} stays IDLE`);
      return res.json({ assigned: false });
    }

    // ✅ STEP 2: Try to lease this instance
    try {
      const lease = await assignOrStartInstance({});

      if (!lease?.id) {
        await GameSession.findByIdAndUpdate(session._id, {
          status: "waiting",
          leasing: false,
        });
        log(`[Instance Ready] Failed to lease instance for ${session._id}`);
        return res.json({ assigned: false });
      }

      // ✅ STEP 3: Determine if session was QUEUED or DIRECT
      const wasQueued = session.queueType === "queued";

      // ✅ STEP 4: Update session with instance details
      const updates = {
        instanceId: lease.id,
        instanceIp: lease.ip,
        leaseToken: lease.leaseToken,
        leaseExpiresAt: new Date(Date.now() + 1800 * 1000),
        expiresAt: new Date(Date.now() + session.maxDurationSeconds * 1000),
        leasing: false,
      };

      // ✅ STEP 5: Determine next status based on queue origin
      if (wasQueued) {
        // Session was in queue → show countdown modal
        updates.status = "allocation_ready";
        updates.phase = "countdown";
        updates.countdownStartsAt = new Date(Date.now() + 5000); // 5s buffer
        updates.countdownSeconds = 30;
        log(`[Instance Ready] Session ${session._id} WAS QUEUED → allocation_ready (show countdown)`);
      } else {
        // Session was direct (just clicked play) → skip to starting
        updates.status = "starting";
        updates.phase = "downloading";
        log(`[Instance Ready] Session ${session._id} WAS DIRECT → starting (show ads)`);
      }

      const updatedSession = await GameSession.findByIdAndUpdate(
        session._id,
        updates,
        { new: true }
      );

      // ✅ STEP 6: Notify SSE clients
      const send = sessionStreams.get(session._id.toString());
      if (send) {
        if (wasQueued) {
          // Queued: send countdown notification
          send({
            status: "allocation_ready",
            phase: "countdown",
            countdownStartsAt: updates.countdownStartsAt,
            countdownSeconds: 30,
          });
        } else {
          // Direct: skip to starting
          send({
            status: "starting",
            phase: "downloading",
          });
        }
      }

      // ✅ STEP 7: For DIRECT sessions, immediately call controller
      // For QUEUED sessions, wait for user to click LAUNCH
      if (!wasQueued) {
        await callController(updatedSession, lease);
      }

      // ✅ STEP 8: Check if more sessions waiting
      const remainingWaiting = await GameSession.countDocuments({
        status: "waiting",
        leasing: false,
      });

      if (remainingWaiting > 0) {
        log(`[Instance Ready] ${remainingWaiting} sessions still waiting, may scale up`);
      }

      return res.json({
        assigned: true,
        sessionId: session._id,
        wasQueued,
        immediatelyCalling: !wasQueued,
      });

    } catch (err) {
      await GameSession.findByIdAndUpdate(session._id, {
        status: "waiting",
        leasing: false,
      });
      console.error("[Instance Ready] Lease error:", err);
      return res.status(500).json({ error: "Lease failed" });
    }

  } catch (err) {
    console.error("[Instance Ready] Fatal error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

/**
 * POST /api/internal/sessions/update
 * Called by instance controller to update session status
 * ✅ Updated: Handles queue system transitions
 */
router.post("/sessions/update", async (req, res) => {
  try {
    const { sessionId, status, error } = req.body;
    console.log(`[Session Update] Received update for session ${sessionId}: ${status}`);

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId required" });
    }

    const session = await GameSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const updates = {};

    switch (status) {
      case "provisioning":
      case "downloading":
        updates.phase = "downloading";
        break;

      case "launching":
        updates.phase = "launching";
        break;

      case "running":
        updates.status = "running";
        updates.phase = null;
        if (!session.startedAt) updates.startedAt = new Date();

        // ✅ Only generate token once
        const existingToken = await cacheService.get(`streamtoken:${sessionId}`);
        if (!existingToken) {
          const streamToken = crypto.randomBytes(31).toString("hex");

          await cacheService.set(
            `stream:${streamToken}`,
            {
              instanceIp: session.instanceIp,
              userId: session.user.toString(),
              sessionId: sessionId,
            },
            session.maxDurationSeconds ?? 3600
          );

          await cacheService.set(
            `streamtoken:${sessionId}`,
            streamToken,
            session.maxDurationSeconds ?? 3600
          );

          console.log(`[StreamToken] Generated for session ${sessionId}: ${streamToken.slice(0, 8)}...`);
        } else {
          console.log(`[StreamToken] Already exists for session ${sessionId}, skipping`);
        }
        break;

      case "failed":
        updates.status = "failed";
        updates.error = error || "Session failed";
        updates.endedAt = new Date();
        updates.phase = null;
        updates.exitReason = "error";
        if (session.instanceId) {
          try{
            const releaseResult = await releaseInstance(session.instanceId, session.leaseToken);
            await cacheService.del(`streamtoken:${sessionId}`);
            await assignOrStartInstance({});
            if (!releaseResult.success) {
              console.error(`[Session Update] Failed to release instance ${session.instanceId} after session failure: ${releaseResult.reason}`);
            } else if (releaseResult.scaled) {
              console.log(`[Session Update] Instance ${session.instanceId} scaled down after session failure`);
            }

          } catch (err) {
            console.error(`[Session Update] Exception while releasing instance ${session.instanceId} after session failure: ${err.message}`);
        }
      }
        break;

      case "ended":
        updates.status = "ended";
        updates.endedAt = new Date();
        updates.phase = null;
        updates.exitReason = "user_exit";
        if (session.instanceId) {
          try{
            const releaseResult = await releaseInstance(session.instanceId, session.leaseToken);
              await cacheService.del(`streamtoken:${sessionId}`);
              await assignOrStartInstance({});
            if (!releaseResult.success) {
              console.error(`[Session Update] Failed to release instance ${session.instanceId} after session failure: ${releaseResult.reason}`);
            } else if (releaseResult.scaled) {
              console.log(`[Session Update] Instance ${session.instanceId} scaled down after session failure`);
            }

          } catch (err) {
            console.error(`[Session Update] Exception while releasing instance ${session.instanceId} after session failure: ${err.message}`);
        }
        }
        break;

      default:
        console.warn(`[Session Update] Unknown status: ${status}`);
    }

    const updatedSession = await GameSession.findByIdAndUpdate(
      sessionId, 
      updates, 
      { new: true }
    );

    // ✅ Publish to SSE clients
    const send = sessionStreams.get(sessionId.toString());
    if (send) {
      send({
        status: updatedSession.status,
        phase: updatedSession.phase,
      });
    }

    await publishSessionEvent(sessionId, {
      status: updatedSession.status,
      phase: updatedSession.phase,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("[Session Update] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/internal/session/launch
 * Called by FRONTEND when user clicks LAUNCH in countdown modal
 * ✅ NEW: Handles transition from countdown → starting
 */
router.post("/session/launch", async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId required" });
    }

    const session = await GameSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // ✅ Only allow launching from allocation_ready state
    if (session.status !== "allocation_ready") {
      return res.status(400).json({
        error: `Cannot launch from status ${session.status}`,
      });
    }

    // ✅ Update to starting
    const updates = {
      status: "starting",
      phase: "downloading",
    };

    const updatedSession = await GameSession.findByIdAndUpdate(
      sessionId,
      updates,
      { new: true }
    );

    // ✅ Notify SSE
    const send = sessionStreams.get(sessionId.toString());
    if (send) {
      send({
        status: "starting",
        phase: "downloading",
      });
    }

    // ✅ Call controller
    await callController(updatedSession, {
      id: session.instanceId,
      ip: session.instanceIp,
      leaseToken: session.leaseToken,
    });

    log(`[Session Launch] Started session ${sessionId} after countdown`);
    return res.json({ ok: true, status: "starting" });
  } catch (err) {
    console.error("[Session Launch] Error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

/**
 * GET /api/internal/resolve/:sessionId
 * Used by proxy to resolve instance IP
 */
router.get("/resolve/:sessionId", async (req, res) => {
  const session = await GameSession.findById(req.params.sessionId)
    .select("instanceIp status")
    .lean();

  if (!session || session.status !== "running") return res.sendStatus(404);

  res.json({ target: `http://${session.instanceIp}:4443` });
});

/**
 * Helper function: Call controller with game payload
 * ✅ Extracted and reusable
 */
async function callController(session, lease) {
  try {
    // Fetch full game details
    const post = await AllPost.findById(session.gamePost).select("gamePost").lean();
    if (!post) {
      throw new Error("Game post not found");
    }

    const game = post.gamePost;

    // ✅ Prepare payload
    const buildId = game.file.name;
    const startPath = game.startPath.replace(/\//g, "\\");
    const fileUrl = game.file.url.replace(/^\/+/, "");
    const s3Url = `${process.env.GAME_S3_URL}/${fileUrl}`;
    const cleanupPolicy = determineCleanupPolicy(game);

    const payload = {
      session_id: session._id.toString(),
      game_id: game.gameName,
      build_id: buildId,
      s3_url: s3Url,
      format: game.file.format,
      start_path: startPath,
      max_duration_seconds: session.maxDurationSeconds,
      backend_api_url: process.env.BACKEND_PUBLIC_URL,
      backend_api_key: process.env.INSTANCE_BACKEND_KEY,
      cleanup_on_normal_exit: cleanupPolicy.on_normal_exit,
      cleanup_on_violation: cleanupPolicy.on_violation,
      cleanup_on_timeout: cleanupPolicy.on_timeout,
      delete_game_files: cleanupPolicy.delete_game_files,
      shared_build: cleanupPolicy.shared_build,
    };

    console.log(`[Controller] Calling http://${lease.ip}:4443/start-session`);
    console.log(`[Controller] Payload:`, JSON.stringify(payload, null, 2));

    fetch(`http://${lease.ip}:4443/start-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Id": session._id.toString(),
      },
      body: JSON.stringify(payload),
    })
      .then(async (r) => {
        const text = await r.text();
        console.log(`[Controller] Response ${r.status}: ${text}`);
      })
      .catch((err) => {
        console.error(`[Controller] Fetch failed: ${err.message}`);
        GameSession.findByIdAndUpdate(session._id, {
          status: "failed",
          exitReason: "error",
          error: err.message,
        }).catch(() => {});
      });

    log(`[Controller] Started session ${session._id}`);
  } catch (err) {
    console.error("[Controller] Error:", err);
    throw err;
  }
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

function log(msg) {
  console.log(`[Internal] ${msg}`);
}

export default router;