import express from "express";
import GameSession from "../models/GameSession.js";
import { publishSessionEvent } from "../services/sessionPubSub.js";
import { releaseInstance, assignOrStartInstance , claimWorkerInDynamo} from "../services/instanceAllocator.js";
import fetch from "node-fetch";
import { sessionStreams } from "../services/sessionStream.js";
import AllPost from "../models/Allposts.js";
import cacheService from "../services/cacheService.js";
import crypto from "crypto";
import { callController } from "../services/controllerService.js";

const router = express.Router();

function log(msg) {
  console.log(`[Internal] ${msg}`);
}

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
 * ✅ Handles both queue and direct allocation + prepares for restart
 */
router.post("/instance-ready", verifyInternalKey, async (req, res) => {
  const { workerId, instanceIp } = req.body;

  if (!workerId || !instanceIp) {
    return res.status(400).json({ error: "workerId and instanceIp required" });
  }

  try {
    // Find next waiting session (FIFO, queued first)
    const session = await GameSession.findOneAndUpdate(
      { status: "waiting", leasing: { $ne: true } },
      { $set: { leasing: true, lastAllocationAttempt: new Date() } },
      { sort: { queueType: -1, createdAt: 1 }, new: true }
    );

    if (!session) {
      log(`[Instance Ready] No waiting sessions, ${workerId} stays IDLE`);
      // Instance is already IDLE in DynamoDB from worker.py — nothing to do
      return res.json({ assigned: false });
    }

const freshSession = await GameSession.findById(session._id);

if (freshSession.instanceId) {
  log(`[Instance Ready] Session already assigned (fresh check), skipping`);
  return res.json({ assigned: true });
}
console.log(`[DEBUG] Attempting claim for worker ${workerId}`);

    // ✅ Generate lease token HERE, write it to DynamoDB atomically
    const leaseToken = crypto.randomUUID();
    const leaseExpiresAt = Math.floor(Date.now() / 1000) + 1800;

    // ✅ Atomically claim the IDLE worker
    try {
      await claimWorkerInDynamo(workerId, leaseToken, leaseExpiresAt);
    } catch (err) {
  console.error("Dynamo claim failed:", err.name, err.message);

  if (err.name === "ConditionalCheckFailedException") {
    log(`[Instance Ready] Worker ${workerId} not IDLE at claim time`);
  } else {
    log(`[Instance Ready] Dynamo error (NOT race): ${err.message}`);
  }

  await GameSession.findByIdAndUpdate(session._id, {
    status: "waiting",
    leasing: false,
  });

  return res.json({ assigned: false });
}

    const wasQueued = session.queueType === "queued";

    const updates = {
      instanceId: workerId,
      instanceIp,
      leaseToken,
      leaseExpiresAt: new Date(leaseExpiresAt * 1000),
      expiresAt: new Date(Date.now() + session.maxDurationSeconds * 1000),
      leasing: false,
      ...(wasQueued
        ? {
            status: "allocation_ready",
            phase: "countdown",
            countdownStartsAt: new Date(Date.now() + 5000),
            countdownSeconds: 30,
          }
        : {
            status: "starting",
            phase: "downloading",
          }),
    };

    const updatedSession = await GameSession.findByIdAndUpdate(
      session._id,
      updates,
      { new: true }
    );

    const send = sessionStreams.get(session._id.toString());
    if (send) {
      send(
        wasQueued
          ? {
              status: "allocation_ready",
              phase: "countdown",
              countdownStartsAt: updates.countdownStartsAt,
              countdownSeconds: 30,
            }
          : { status: "starting", phase: "downloading" }
      );
    }

    if (!wasQueued) {
      await callController(updatedSession, {
        id: workerId,
        ip: instanceIp,
        leaseToken,
      });
    }

    return res.json({ assigned: true, sessionId: session._id, wasQueued });

  } catch (err) {
    console.error("[Instance Ready] Fatal error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
});

/**
 * POST /api/internal/sessions/update
 * Called by instance controller to update session status
 * ✅ Handles all phase transitions including cleanup
 */
router.post("/sessions/update", async (req, res) => {
  try {
const sessionId = req.body.sessionId || req.body.session_id;
const { status, error } = req.body;    console.log("[Controller Update] Body:", req.body);
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

        // ✅ Generate stream token
        const existingToken = await cacheService.get(`streamtoken:${sessionId}`);
        if (!existingToken) {
          const streamToken = crypto.randomBytes(31).toString("hex");

          await cacheService.set(
            `stream:${streamToken}`,
            {
              instanceIp: session.instanceIp,
              userId: session.user.toString(),
              sessionId: sessionId,
              status: "running",
            },
            session.maxDurationSeconds ?? 3600
          );

          await cacheService.set(
            `streamtoken:${sessionId}`,
            streamToken,
            session.maxDurationSeconds ?? 3600
          );
          console.log(`[Session Update] Session ${sessionId} marked running`);
          console.log(`[StreamToken] Generated for session ${sessionId}: ${streamToken.slice(0, 8)}...`);
        }
        break;

      case "failed":
        updates.status = "failed";
        updates.error = error || "Session failed";
        updates.endedAt = new Date();
        updates.phase = null;
        updates.exitReason = "error";

        if (session.instanceId && session.leaseToken) {
          try {
            const releaseResult = await releaseInstance(session.instanceId, session.leaseToken);
            const token = await cacheService.get(`streamtoken:${sessionId}`);

              if (token) {
                await cacheService.del(`stream:${token}`);
              }

              await cacheService.del(`streamtoken:${sessionId}`);
          } catch (err) {
            console.error(`[Session Update] Error releasing after failure:`, err.message);
          }
        }
        break;

      case "ended":
      case "ended_and_ready":
        updates.status = "ended";
        updates.endedAt = new Date();
        updates.phase = null;
        updates.exitReason = "user_exit";        

        if (session.instanceId && session.leaseToken) {
          try {
            const releaseResult = await releaseInstance(session.instanceId, session.leaseToken);
            const token = await cacheService.get(`streamtoken:${sessionId}`);

            if (token) {
              await cacheService.del(`stream:${token}`);
            }

            await cacheService.del(`streamtoken:${sessionId}`);
          } catch (err) {
            console.error(`[Session Update] Error releasing after end:`, err.message);
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

   return res.status(200).json({
  success: true,
  sessionId,
  status
});
  } catch (err) {
    console.error("[Session Update] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/internal/session/launch
 * Called by FRONTEND when user clicks LAUNCH in countdown modal
 * ✅ Transition from countdown → starting
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

    if (session.status !== "allocation_ready") {
      return res.status(400).json({
        error: `Cannot launch from status ${session.status}`,
      });
    }

    const updates = {
      status: "starting",
      phase: "downloading",
    };

    const updatedSession = await GameSession.findByIdAndUpdate(
      sessionId,
      updates,
      { new: true }
    );

    const send = sessionStreams.get(sessionId.toString());
    if (send) {
      send({
        status: "starting",
        phase: "downloading",
      });
    }

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




export default router;