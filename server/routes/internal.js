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

router.post("/instance-ready", verifyInternalKey, async (req, res) => {
  const { workerId, instanceIp } = req.body;
  console.log("Instance ready callback:", { workerId, instanceIp });

  if (!workerId || !instanceIp) {
    return res.status(400).json({ error: "workerId and instanceIp required" });
  }

  log(`[Instance Ready] ${workerId} @ ${instanceIp}`);

  const session = await GameSession.findOneAndUpdate(
    { status: "waiting", leasing: false },
    { $set: { leasing: true, status: "assigning", lastAllocationAttempt: new Date() } },
    { sort: { createdAt: 1 }, new: true }
  );

  if (!session) {
    log(`[Instance Ready] No waiting sessions, ${workerId} stays IDLE`);
    return res.json({ assigned: false });
  }

  try {
    const lease = await assignOrStartInstance({});

    if (!lease?.id) {
      await GameSession.findByIdAndUpdate(session._id, {
        status: "waiting",
        leasing: false,
      });
      return res.json({ assigned: false });
    }

    await GameSession.findByIdAndUpdate(session._id, {
      instanceId: lease.id,
      instanceIp: lease.ip,
      leaseToken: lease.leaseToken,
      status: "starting",
      leasing: false,
      expiresAt: new Date(Date.now() + session.maxDurationSeconds * 1000),
    });

    const remainingWaiting = await GameSession.countDocuments({
      status: "waiting",
      leasing: false,
    });

    if (remainingWaiting > 0) {
      console.log(`[Instance Ready] ${remainingWaiting} sessions still waiting, triggering scale`);
      assignOrStartInstance({}).then((nextLease) => {
        if (nextLease?.id) {
          console.log(`[Instance Ready] Another idle instance found, will be picked up on next instance-ready`);
        }
      }).catch(() => {});
    }

    const send = sessionStreams.get(session._id.toString());
    if (send) send({ status: "starting" });

    // Fetch full game details
    const post = await AllPost.findById(session.gamePost).select("gamePost").lean();
    const game = post.gamePost;

    // ✅ Strip extension from build_id
    const buildId = game.file.name;

    // ✅ Fix start_path — forward slashes to backslashes
    const startPath = game.startPath.replace(/\//g, "\\");

    // ✅ Fix s3_url — use s3:// format which provisioner expects
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
    console.log(`[Controller] Full payload:`, JSON.stringify(payload, null, 2));

    fetch(`http://${lease.ip}:4443/start-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Id": session._id.toString(),
      },
      body: JSON.stringify(payload),
    }).then(async (r) => {
      const text = await r.text();
      console.log(`[Controller] Response ${r.status}: ${text}`);
    }).catch((err) => {
      console.error(`[Controller] Fetch FAILED: ${err.message}`);
      GameSession.findByIdAndUpdate(session._id, {
        status: "failed",
        exitReason: "error",
      }).catch(() => {});
    });

    log(`[Instance Ready] Assigned ${lease.id} to session ${session._id}`);
    return res.json({ assigned: true, sessionId: session._id });

  } catch (err) {
    await GameSession.findByIdAndUpdate(session._id, {
      status: "waiting",
      leasing: false,
    });
    console.error("[Instance Ready] Error:", err);
    return res.status(500).json({ error: "Allocation failed" });
  }
});

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

      case "running":
        updates.status = "running";
        updates.phase = null;
        if (!session.startedAt) updates.startedAt = new Date();

        // ✅ Only generate token once — check if already exists
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
        if (session.instanceId) {
          releaseInstance(session.instanceId, session.leaseToken).catch(console.error);
        }
        break;

      case "ended":
        updates.status = "ended";
        updates.endedAt = new Date();
        updates.phase = null;
        if (session.instanceId) {
          releaseInstance(session.instanceId, session.leaseToken).catch(console.error);
        }
        break;

      default:
        console.warn(`[Session Update] Unknown status: ${status}`);
    }

    const updatedSession = await GameSession.findByIdAndUpdate(
      sessionId, updates, { new: true }
    );

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

router.get("/resolve/:sessionId", async (req, res) => {
  const session = await GameSession.findById(req.params.sessionId)
    .select("instanceIp status")
    .lean();

  if (!session || session.status !== "running") return res.sendStatus(404);

  res.json({ target: `http://${session.instanceIp}:4443` });
});

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