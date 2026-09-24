import express from "express";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import crypto from "crypto";
import { body, validationResult, param } from "express-validator";
import { publishSessionEvent } from "../services/sessionPubSub.js";
import DemoConsumption from "../models/DemoConsumption.js";
import AllPost from "../models/Allposts.js";
import GameSession from "../models/GameSession.js";
import {
  assignOrStartInstance,
  releaseInstance,
  renewLease,
} from "../services/instanceAllocator.js";
import verifyToken from "../middlewares/authMiddleware.js";
import cacheService from "../services/cacheService.js";
import { SessionMetrics } from "../services/sessionMetrics.js";
import { sessionStreams } from "../services/sessionStream.js";
import { callController } from "../services/controllerService.js";
import PostAnalytics from "../models/postAnalytics.js";
import { processBilling } from "../services/creditBilling.js";
import CreditAudit from "../models/CreditAudit.js";
import GameFeedback from "../models/GameFeedback.js";
import {
  getQueueData,
  finalizeSession,
  recordSessionAnalytics,
  recordDemoConsumptionAnalytics,
  startOrTouchDemoConsumption,
  finalizeDemoConsumption,
  createConsumptionAudit,
  calculateSessionDuration,
  determineCleanupPolicy,
} from "../helper/session.js";
import UserSession from "../models/UserSession.js";
import { selectRegion } from "../services/regionSelector.js";
import { reconcileCapacity } from "../services/capacityReconciler.js";
import {
  createSessionStorage,
  deleteSessionStorage,
} from "../services/sessionStorage.js";
import { tryFinalizeSessionAllocation } from "../services/sessionAllocationCoordinator.js";

const router = express.Router();
const metrics = new SessionMetrics();

const CONFIG = {
  DEFAULT_DURATION: 600,
  FREE_GAME_DURATION: 600,
  PAID_GAME_DURATION: 600,
  MAX_CONCURRENT_SESSIONS: 3,
  INSTANCE_TIMEOUT: 10000,
  RETRY_ATTEMPTS: 2,
};

const DEMO_CONFIG = {
  MIN_ACTIVE_SECONDS: 120,
  HEARTBEAT_GRACE_SECONDS: 25,
};

/**
 * POST /api/sessions/start
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

      let post = await cacheService.getGamePost(gamePostId);

      if (!post) {
        post = await AllPost.findById(gamePostId)
          .select("type user gamePost")
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

      const isAdmin = req.user.role === "admin";
      const isOwner = post.user?.toString() === userId;
      const skipDemoConsumption = isAdmin || isOwner;

      if (!skipDemoConsumption) {
        const alreadyUsed = await DemoConsumption.findOne({
          user: userId,
          gamePost: gamePostId,
          status: "consumed",
        }).lean();

        if (alreadyUsed) {
          return res.status(403).json({
            error: "Demo already consumed for this game",
          });
        }
      }

      const activeSessions = await GameSession.countDocuments({
        user: userId,
        status: {
          $in: ["waiting", "allocation_ready", "starting", "running"],
        },
      });

      if (activeSessions >= 1) {
        return res.status(429).json({
          error: "Maximum concurrent sessions reached",
          active: activeSessions,
        });
      }

      const game = post.gamePost;
      const snapshot = game.snapshot;

      const allRegionalSnapshotsReady =
        snapshot?.status === "ready" &&
        Array.isArray(snapshot?.regions) &&
        snapshot.regions.length > 0 &&
        snapshot.regions.every(
          (region) => region?.status === "ready" && !!region?.snapshotId
        );

      if (!allRegionalSnapshotsReady) {
        return res.status(409).json({
          error: "Game is not ready to play",
          code: "SNAPSHOTS_NOT_READY",
        });
      }

      if (
        !game.isTestUpload &&
        (game.creditBudget?.status === "exhausted" ||
          (game.creditBudget?.remainingCredits ?? 0) <= 0)
      ) {
        return res.status(403).json({
          error: "Credits exhausted",
        });
      }

      const maxDurationSeconds = calculateSessionDuration(game);

      let queueType = "direct";
      let response202 = { status: "waiting" };
      let assignedInstance = null;
      let allocationType = null;
      let allocationRequestId = null;
      let baselineInstanceIds = [];

      const userSession = await UserSession.findOne({ user: userId })
        .select("geo.latitude geo.longitude geo.countryCode")
        .sort({ lastActivityAt: -1 })
        .lean();

      const preferredRegion = selectRegion(userSession);

      console.log(
        "[Region]",
        userSession?.geo?.countryCode,
        "->",
        preferredRegion
      );

      try {
        const leaseResult = await assignOrStartInstance({ preferredRegion });

        if (leaseResult?.status === "ASSIGNED") {
          assignedInstance = leaseResult;
          allocationType = "idle";
          response202.status = "waiting";

          console.log(
            "[Session Start] Existing GPU leased; storage preparation required",
            {
              workerId: leaseResult.workerId,
              region: leaseResult.region,
              availabilityZone: leaseResult.availabilityZone,
            }
          );
        } else if (leaseResult?.status === "WAITING" || leaseResult?.queued) {
          queueType = "queued";
          allocationType = "queued";

          console.log("[Session Start] User entering actual queue", {
            position: leaseResult.queuePosition,
            total: leaseResult.totalQueued,
            wait: leaseResult.estimatedWaitMinutes,
          });

          response202.status = "waiting";
          response202.queuePosition = leaseResult.queuePosition;
          response202.totalQueued = leaseResult.totalQueued;
          response202.estimatedWaitMinutes = leaseResult.estimatedWaitMinutes;
          response202.avgSessionDuration = leaseResult.avgSessionDuration;
        } else if (leaseResult?.status === "SCALING" || leaseResult?.scaling) {
          queueType = "direct";
          allocationType = "scaling";
          allocationRequestId = leaseResult.allocationRequestId || null;
          baselineInstanceIds = Array.isArray(leaseResult.baselineInstanceIds)
            ? leaseResult.baselineInstanceIds
            : [];

          response202.status = "waiting";

          console.log("[Session Start] GPU scaling started", {
            allocationRequestId,
            region: leaseResult.region || preferredRegion,
            baselineCount: baselineInstanceIds.length,
            desiredCapacity: leaseResult.desiredCapacity,
            targetCapacity: leaseResult.targetCapacity,
          });
        }
      } catch (err) {
        console.error(
          "[Session Start] Allocation check error (non-fatal):",
          err.message
        );
      }

      const session = await GameSession.create({
        user: userId,
        gamePost: gamePostId,
        status: "waiting",
        phase: null,
        maxDurationSeconds,
        queueType,
        instanceRegion: assignedInstance?.region || preferredRegion,
        allocation: {
          type: allocationType,
          requestId: allocationRequestId,
          baselineInstanceIds,
        },
        instanceId: assignedInstance?.workerId || null,
        instanceIp: assignedInstance?.instanceIp || null,
        leaseToken: assignedInstance?.leaseToken || null,
        leaseExpiresAt: assignedInstance?.leaseExpiresAt
          ? new Date(assignedInstance.leaseExpiresAt * 1000)
          : null,
        storage: {
          status: "pending",
          availabilityZone: assignedInstance?.availabilityZone || null,
        },
        metadata: {
          gameVersion: game.version,
          platform: game.platform,
          gpuRequired: game.systemRequirements?.gpuRequired || false,
          skipDemoConsumption,
        },
      });

      response202.sessionId = session._id;
      response202.queueType = queueType;
      response202.allocationType = allocationType;

      if (assignedInstance?.instanceId || assignedInstance?.workerId) {
        createSessionStorage(session._id)
          .then(() => {
            return tryFinalizeSessionAllocation(session._id);
          })
          .catch((error) => {
            console.error(`[Start] Storage failed ${session._id}:`, error);
          });
      }

      if (allocationRequestId) {
        response202.allocationRequestId = allocationRequestId;
      }

      reconcileCapacity(session.instanceRegion).catch(console.error);

      const send = sessionStreams.get(session._id.toString());

      if (send) {
        send({
          status: "waiting",
          phase: null,
          queueType,
          allocationType,
        });
      }

      console.log(`[Session Start] Returning 202`, response202);
      res.status(202).json(response202);
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

router.get("/status-by-token/:token", async (req, res) => {
  try {
    const { token } = req.params;
    console.log("Status by token request:", token);

    const stream = await cacheService.get(`stream:${token}`);

    if (!stream) {
      return res.status(404).json({ active: false });
    }

    return res.status(200).json({ active: true });
  } catch (err) {
    console.error("Status by token error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/active", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const session = await GameSession.findOne({
      user: userId,
      status: {
        $in: [
          "waiting",
          "allocation_ready",
          "starting",
          "running",
          "ending",
        ],
      },
    })
      .sort({ createdAt: -1 })
      .select(
        "_id status phase queueType countdownStartsAt countdownSeconds allocationExpiresAt startedAt expiresAt maxDurationSeconds"
      )
      .lean();

    if (!session) {
      return res.json({ active: false });
    }

    let queueData = {};

    if (session.status === "waiting" && session.queueType === "queued") {
      queueData = await getQueueData(session);
    }

    return res.json({
      active: true,
      sessionId: session._id,
      status: session.status,
      phase: session.phase,
      queueType: session.queueType,
      countdownStartsAt: session.countdownStartsAt,
      countdownSeconds: session.countdownSeconds,
      allocationExpiresAt: session.allocationExpiresAt,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
      maxDurationSeconds: session.maxDurationSeconds,
      ...queueData,
    });
  } catch (err) {
    console.error("Active session lookup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/sessions/feedback/pending
 */
router.get("/feedback/pending", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const session = await GameSession.findOne({
      user: userId,
      status: "ended",
      "feedback.submitted": { $ne: true },
      "feedback.feedbackPromptedAt": null,
    })
      .sort({ endedAt: -1 })
      .populate({
        path: "gamePost",
        select: "gamePost.gameName gamePost.steamUrl",
      })
      .select("_id status gamePost metrics.totalPlayTime feedback endedAt")
      .lean();

    if (!session) {
      return res.json({ eligible: false });
    }

    const playTimeMs = session.metrics?.totalPlayTime || 0;

    if (playTimeMs < 120000) {
      return res.json({ eligible: false });
    }

    const promptedAt = new Date();
    const promptedSession = await GameSession.findOneAndUpdate(
      {
        _id: session._id,
        user: userId,
        status: "ended",
        "feedback.submitted": { $ne: true },
        "feedback.feedbackPromptedAt": null,
      },
      {
        $set: { "feedback.feedbackPromptedAt": promptedAt },
      },
      { new: true }
    );

    if (!promptedSession) {
      return res.json({ eligible: false });
    }

    return res.json({
      eligible: true,
      sessionId: session._id,
      gameId: session.gamePost?._id,
      gameName: session.gamePost?.gamePost?.gameName || null,
      steamUrl: session.gamePost?.gamePost?.steamUrl || null,
      playTimeMs,
    });
  } catch (err) {
    console.error("[Feedback] Pending feedback lookup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/sessions/:sessionId/status
 */
router.get("/:sessionId/status", verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await GameSession.findById(sessionId)
      .select(
        "user status phase countdownStartsAt countdownSeconds allocationExpiresAt startedAt expiresAt maxDurationSeconds"
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
      allocationExpiresAt: session.allocationExpiresAt,
      remainingSeconds,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
    });
  } catch (err) {
    console.error("Session status error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Feedback eligibility check
router.get(
  "/check/:sessionId",
  verifyToken,
  [param("sessionId").isMongoId().withMessage("Invalid session id")],
  async (req, res) => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: "Validation failed",
          details: errors.array(),
        });
      }

      const { sessionId } = req.params;
      const userId = req.user.id;

      const session = await GameSession.findOne({
        _id: sessionId,
        user: userId,
      })
        .populate({
          path: "gamePost",
          select: "gamePost.gameName gamePost.steamUrl",
        })
        .select("_id status gamePost metrics.totalPlayTime feedback")
        .lean();

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.status !== "ended") {
        return res.json({ eligible: false });
      }

      const playTimeMs = session.metrics?.totalPlayTime || 0;

      if (playTimeMs < 120000) {
        return res.json({ eligible: false });
      }

      if (session.feedback?.submitted) {
        return res.json({ eligible: false });
      }

      const promptedSession = await GameSession.findOneAndUpdate(
        {
          _id: sessionId,
          user: userId,
          status: "ended",
          "feedback.submitted": { $ne: true },
          "feedback.feedbackPromptedAt": null,
        },
        {
          $set: { "feedback.feedbackPromptedAt": new Date() },
        },
        { new: true }
      );

      if (!promptedSession) {
        return res.json({ eligible: false });
      }

      return res.json({
        eligible: true,
        sessionId: promptedSession._id,
        gameId: session.gamePost?._id,
        gameName: session.gamePost?.gamePost?.gameName || null,
        steamUrl: session.gamePost?.gamePost?.steamUrl || null,
        playTimeMs,
      });
    } catch (err) {
      console.error("[Feedback] Eligibility check error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * GET /api/sessions/:sessionId/events
 */
router.get("/:sessionId/events", verifyToken, async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.id;

  console.log(`[SSE (Session)] User ${userId} requested events for session ${sessionId}`);

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

  const sendCurrentState = async () => {
    const fresh = await GameSession.findById(sessionId).lean();

    if (!fresh) return;

    let queueData = {};

    if (fresh.status === "waiting" && fresh.queueType === "queued") {
      queueData = await getQueueData(fresh);
    }

    send({
      status: fresh.status,
      phase: fresh.phase,
      countdownStartsAt: fresh.countdownStartsAt,
      countdownSeconds: fresh.countdownSeconds,
      allocationExpiresAt: fresh.allocationExpiresAt,
      ...queueData,
    });
  };

  await sendCurrentState();

  const interval = setInterval(async () => {
    try {
      await sendCurrentState();
    } catch (err) {
      console.error("Queue SSE update error:", err);
    }
  }, 5000);

  sessionStreams.set(sessionId.toString(), send);

  req.on("close", () => {
    clearInterval(interval);
    sessionStreams.delete(sessionId.toString());
  });
});

/**
 * GET /api/sessions/:sessionId/stream-token
 */
router.get("/:sessionId/stream-token", verifyToken, async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.id;

  const session = await GameSession.findById(sessionId).lean();

  if (!session) {
    return res.sendStatus(404);
  }

  if (session.user.toString() !== userId) {
    return res.sendStatus(403);
  }

  if (session.status !== "running") {
    return res.status(400).json({ error: "Session not ready" });
  }

  const streamToken = await cacheService.get(`streamtoken:${sessionId}`);

  if (!streamToken) {
    return res.status(400).json({ error: "Stream token not available yet" });
  }

  res.json({
    streamUrl: `https://${streamToken}.${process.env.STREAM_DOMAIN}`,
  });
});

/**
 * POST /api/sessions/:sessionId/heartbeat
 */
router.post("/:sessionId/heartbeat", verifyToken, async (req, res) => {
  try {
    await GameSession.findOneAndUpdate(
      {
        _id: req.params.sessionId,
        user: req.user.id,
        status: { $in: ["waiting", "starting", "running"] },
      },
      {
        lastHeartbeat: new Date(),
      }
    );

    res.sendStatus(200);
  } catch (err) {
    console.error("Heartbeat error:", err);
    res.sendStatus(500);
  }
});

router.post("/heartbeat-by-token/:token", async (req, res) => {
  try {
    const { token } = req.params;
    console.log("Heartbeat from stream", token);

    const cached = await cacheService.get(`stream:${token}`);

    if (!cached) {
      return res.sendStatus(404);
    }

    const session = await GameSession.findById(cached.sessionId);

    if (!session) {
      return res.sendStatus(404);
    }

    const now = new Date();

    await GameSession.findByIdAndUpdate(session._id, {
      lastHeartbeat: now,
      $unset: { disconnectDeadline: "" },
    });

    const remainingLease = session.leaseExpiresAt
      ? session.leaseExpiresAt.getTime() - Date.now()
      : 0;

    if (session.instanceId && remainingLease < 10 * 60 * 1000) {
      try {
        await renewLease(session.instanceId, session.instanceRegion);
        await GameSession.findByIdAndUpdate(session._id, {
          leaseExpiresAt: new Date(Date.now() + 3600 * 1000),
        });
      } catch (err) {
        console.error("Lease renewal failed", err);
      }
    }

    const billingResult = await processBilling(session._id);
    await startOrTouchDemoConsumption(session, now);

    if (billingResult?.exhausted) {
      const reason = "credits_exhausted";

      await GameSession.findByIdAndUpdate(session._id, {
        exitReason: reason,
      });

      if (session.instanceIp) {
        try {
          const controllerRes = await fetch(
            `http://${session.instanceIp}:4443/stop-session`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Session-Id": session._id.toString(),
              },
              body: JSON.stringify({ session_id: session._id.toString() }),
            }
          );

          const responseText = await controllerRes.text();
          console.log(`[Credits] Controller stop response ${controllerRes.status}: ${responseText}`);
        } catch (stopErr) {
          console.error("[Credits] Failed to notify controller:", stopErr.message);
        }
      } else {
        await finalizeSession(session, reason);

        try {
          await deleteSessionStorage(session._id);
        } catch (storageErr) {
          console.error("[Credits] Storage cleanup failed:", storageErr);
        }

        if (session.instanceId && session.leaseToken) {
          try {
            const releaseResult = await releaseInstance(
              session.instanceId,
              session.leaseToken,
              session.instanceRegion
            );
            console.log("[Credits] Release result:", releaseResult);
          } catch (releaseErr) {
            console.error("[Credits] GPU release failed:", releaseErr);
          }
        }

        reconcileCapacity(session.instanceRegion).catch(console.error);
      }

      return res.status(410).json({ error: "credits_exhausted" });
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Heartbeat by token error:", err);
    res.sendStatus(500);
  }
});

/**
 * POST /api/sessions/:sessionId/cancel
 */
router.post("/:sessionId/cancel", verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await GameSession.findById(sessionId);
    console.log(`[Session Cancel] User requested cancel for session ${sessionId}`);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.user.toString() !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const reason = "user_cancelled";
    console.log(`[Session Cancel] User cancelled session ${sessionId} with reason ${reason}`);

    await GameSession.findByIdAndUpdate(session._id, {
      exitReason: reason,
    });

    if (session.instanceIp) {
      try {
        const controllerRes = await fetch(
          `http://${session.instanceIp}:4443/stop-session`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Session-Id": session._id.toString(),
            },
            body: JSON.stringify({ session_id: session._id.toString() }),
          }
        );

        const responseText = await controllerRes.text();
        console.log(`[Cancel] Controller stop response ${controllerRes.status}: ${responseText}`);
      } catch (err) {
        console.error("[Cancel] Failed to notify controller:", err.message);
      }
    } else {
      await finalizeSession(session, reason);

      try {
        await deleteSessionStorage(session._id);
      } catch (storageErr) {
        console.error("[Cancel] Storage cleanup failed:", storageErr);
      }

      if (session.instanceId && session.leaseToken) {
        try {
          const releaseResult = await releaseInstance(
            session.instanceId,
            session.leaseToken,
            session.instanceRegion
          );
          console.log("[Cancel] Release result:", releaseResult);
        } catch (err) {
          console.error("[Cancel] Error releasing instance:", err.message);
        }
      }

      reconcileCapacity(session.instanceRegion).catch(console.error);
    }

    const send = sessionStreams.get(sessionId.toString());

    if (send) {
      send({
        status: session.instanceIp ? "ending" : "ended",
        reason,
      });
    }

    return res.json({
      message: session.instanceIp
        ? "Session cancellation requested"
        : "Session cancelled",
      sessionId,
    });
  } catch (err) {
    console.error("Session cancel error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/sessions/cancel-by-token/:token
 */
router.post("/cancel-by-token/:token", async (req, res) => {
  try {
    const { token } = req.params;
    console.log(`[Session Cancel] Stream requested cancel via token: ${token}`);

    const cached = await cacheService.get(`stream:${token}`);

    if (!cached) {
      return res.status(404).json({ error: "Stream token invalid or expired" });
    }

    const session = await GameSession.findById(cached.sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const reason = "user_exit";

    await GameSession.findByIdAndUpdate(session._id, {
      exitReason: reason,
    });

    if (session.instanceIp) {
      try {
        const controllerRes = await fetch(
          `http://${session.instanceIp}:4443/stop-session`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Session-Id": session._id.toString(),
            },
            body: JSON.stringify({ session_id: session._id.toString() }),
          }
        );

        const responseText = await controllerRes.text();
        console.log(`[Cancel by Token] Controller stop response ${controllerRes.status}: ${responseText}`);
      } catch (err) {
        console.error("[Cancel by Token] Failed to notify controller:", err.message);
      }
    } else {
      await finalizeSession(session, reason);

      try {
        await deleteSessionStorage(session._id);
      } catch (storageErr) {
        console.error("[Cancel by Token] Storage cleanup failed:", storageErr);
      }

      if (session.instanceId && session.leaseToken) {
        try {
          await releaseInstance(
            session.instanceId,
            session.leaseToken,
            session.instanceRegion
          );
        } catch (err) {
          console.error("[Cancel by Token] Error releasing instance:", err.message);
        }
      }

      reconcileCapacity(session.instanceRegion).catch(console.error);
    }

    await cacheService.del(`stream:${token}`);
    await cacheService.del(`streamtoken:${session._id}`);

    const send = sessionStreams.get(session._id.toString());

    if (send) {
      send({
        status: session.instanceIp ? "ending" : "ended",
        reason,
      });
    }

    return res.json({
      message: session.instanceIp
        ? "Session cancellation requested"
        : "Session successfully cancelled",
    });
  } catch (err) {
    console.error("Cancel by token error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/sessions/:sessionId/abandon/:secret
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

    console.log(`[Abandon] Marking session ${sessionId} as disconnecting`);

    await GameSession.findByIdAndUpdate(sessionId, {
      disconnectDeadline: new Date(Date.now() + 60000),
      exitReason: "disconnect",
    });

    return res.sendStatus(200);
  } catch (err) {
    console.error("Abandon error:", err);
    return res.sendStatus(500);
  }
});

/**
 * POST /api/sessions/running
 */
router.post("/running", async (req, res) => {
  const { session_id } = req.body;
  console.log("[Running] Payload:", req.body);

  if (!session_id) {
    return res.status(400).json({ error: "session_id required" });
  }

  try {
    const session = await GameSession.findById(session_id);

    if (!session) {
      console.warn(`[Running] Session not found: ${session_id}`);
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.status !== "running") {
      const now = new Date();

      await GameSession.findByIdAndUpdate(session_id, {
        status: "running",
        phase: null,
        startedAt: now,
        "billing.lastBillingAt": now,
      });

      const existingSession = await GameSession.exists({
        gamePost: session.gamePost,
        user: session.user,
        _id: { $ne: session._id },
      });

      console.log(`[Running] Session ${session_id} is now streaming`);

      const send = sessionStreams.get(session_id.toString());
      if (send) {
        send({
          status: "running",
          phase: null,
        });
      }

      try {
        await publishSessionEvent(session_id, {
          status: "running",
          phase: null,
        });
      } catch (err) {
        console.warn("[Running] PubSub publish failed:", err.message);
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("[Running] Error:", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

/**
 * POST /api/sessions/complete
 */
router.post("/complete", async (req, res) => {
  try {
    const { session_id, exit_reason, exit_code, duration_seconds } = req.body;
    console.log("[Session Complete] Payload:", req.body);

    const session = await GameSession.findById(session_id);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    console.log(`[Session Complete] Completing session ${session_id} with reason ${exit_reason} and duration ${duration_seconds}s`);

    if (session.status !== "ended") {
      const finalReason = exit_reason || session.exitReason || "user_exit";

      await GameSession.findByIdAndUpdate(session._id, {
        exitReason: finalReason,
      });

      const token = await cacheService.get(`streamtoken:${session_id}`);

      if (token) {
        await cacheService.del(`stream:${token}`);
      }

      await cacheService.del(`streamtoken:${session_id}`);

      const send = sessionStreams.get(session_id.toString());
      if (send) {
        send({
          status: "ending",
          reason: finalReason,
        });
      }

      metrics.recordSessionEnd(session.user.toString(), session_id);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Session complete error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/sessions/violation
 */
router.post("/violation", async (req, res) => {
  try {
    const { session_id, violation, exit_code, duration_seconds } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: "session_id required" });
    }

    const session = await GameSession.findById(session_id);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    console.log(`[Session Violation] Session ${session_id} violation: ${violation}`);

    const exitReason = violation || "error";

    await GameSession.findByIdAndUpdate(session._id, {
      exitReason,
    });

    if (session.instanceIp) {
      try {
        const controllerRes = await fetch(
          `http://${session.instanceIp}:4443/stop-session`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Session-Id": session._id.toString(),
            },
            body: JSON.stringify({ session_id: session._id.toString() }),
          }
        );

        const responseText = await controllerRes.text();
        console.log(`[Violation] Controller stop response ${controllerRes.status}: ${responseText}`);
      } catch (err) {
        console.error("[Violation] Failed to notify controller:", err.message);
      }
    } else {
      await finalizeSession(session, exitReason);

      try {
        await deleteSessionStorage(session._id);
      } catch (storageErr) {
        console.error("[Session Violation] Storage cleanup failed:", storageErr);
      }

      if (session.instanceId && session.leaseToken) {
        try {
          await releaseInstance(
            session.instanceId,
            session.leaseToken,
            session.instanceRegion
          );
        } catch (releaseErr) {
          console.error("[Violation] GPU release failed:", releaseErr);
        }
      }

      reconcileCapacity(session.instanceRegion).catch(console.error);
    }

    const token = await cacheService.get(`streamtoken:${session_id}`);

    if (token) {
      await cacheService.del(`stream:${token}`);
    }

    await cacheService.del(`streamtoken:${session_id}`);

    const send = sessionStreams.get(session_id.toString());
    if (send) {
      send({
        status: session.instanceIp ? "ending" : "ended",
        reason: exitReason,
      });
    }

    await publishSessionEvent(session_id, {
      status: session.instanceIp ? "ending" : "ended",
      phase: null,
      reason: exitReason,
    });

    console.log(`[Session Violation] Session ${session_id} shutdown requested`);

    return res.json({ success: true });
  } catch (err) {
    console.error("[Session Violation] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;