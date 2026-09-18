import express from "express";
import GameSession from "../models/GameSession.js";
import { publishSessionEvent } from "../services/sessionPubSub.js";
import {
  releaseInstance,
  leaseSpecificInstance,
} from "../services/instanceAllocator.js";
import fetch from "node-fetch";
import { sessionStreams } from "../services/sessionStream.js";
import AllPost from "../models/Allposts.js";
import cacheService from "../services/cacheService.js";
import crypto from "crypto";
import { callController } from "../services/controllerService.js";
import {reconcileCapacity} from "../services/capacityReconciler.js";
import { ALLOCATION_GRACE_MS } from "../helper/session.js";
import {
  createSessionStorage, deleteSessionStorage
} from "../services/sessionStorage.js";

import {
  tryFinalizeSessionAllocation,
} from "../services/sessionAllocationCoordinator.js";



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
 *
 * Called by a GPU worker after:
 *   1. EC2 is running
 *   2. Session controller is ready
 *   3. Worker is registered as IDLE in DynamoDB
 *
 * IMPORTANT:
 * The worker sends its exact instanceId.
 *
 * This allows a scaling session to lease the SAME EC2
 * that was created for that allocation.
 *
 * GPU readiness and EBS readiness are intentionally
 * independent. We do NOT start the controller here.
 *
 * The session allocation coordinator will start the
 * controller only when BOTH are ready.
 */
router.post("/instance-ready", verifyInternalKey, async (req, res) => {
  const { region, instanceId } = req.body;

  if (!region || !instanceId) {
    return res.status(400).json({
      error: "region and instanceId are required",
    });
  }

  try {
    log(`[Instance Ready] Worker ready instanceId=${instanceId} region=${region}`);

    /*
     * ------------------------------------------------------------
     * STEP 1
     * Find a session that is waiting specifically for this
     * scaling allocation.
     *
     * The allocation.type === "scaling" check is important.
     *
     * We must NOT accidentally take:
     *   waiting + queued
     * sessions here.
     */
    const scalingSession = await GameSession.findOneAndUpdate(
      {
        status: "waiting",
        "allocation.type": "scaling",
        "allocation.baselineInstanceIds": { $exists: true },
        instanceRegion: region,
        endedAt: null,
        leasing: false,
      },
      {
        $set: {
          leasing: true,
          lastAllocationAttempt: new Date(),
        },
      },
      {
        sort: { createdAt: 1 },
        new: true,
      }
    );

    /*
     * ------------------------------------------------------------
     * STEP 2
     * If this is a scaling session, lease EXACTLY this instance.
     */
    if (scalingSession) {
      log(`[Instance Ready] Scaling session found: ${scalingSession._id} -> ${instanceId}`);

      /*
       * Prevent a stale/duplicate worker notification from
       * assigning an already-associated instance.
       */
      const fresh = await GameSession.findById(scalingSession._id).lean();

      if (!fresh || fresh.endedAt || fresh.instanceId) {
        log(`[Instance Ready] Session ${scalingSession._id} is no longer eligible`);
        return res.json({
          assigned: false,
          reason: "session_no_longer_eligible",
        });
      }

      /*
       * Lease THIS worker.
       *
       * Do NOT use assignOrStartInstance() here because that
       * could select another IDLE GPU.
       */
      const lease = await leaseSpecificInstance(instanceId, region);

      if (lease.status !== "ASSIGNED") {
        await GameSession.findByIdAndUpdate(scalingSession._id, {
          $set: { leasing: false },
        });

        log(
          `[Instance Ready] Specific lease failed instance=${instanceId} ` +
          `status=${lease.status} reason=${lease.reason || "unknown"}`
        );

        return res.json({
          assigned: false,
          reason: lease.status,
          instanceId,
        });
      }

      /*
       * ----------------------------------------------------------
       * STEP 3
       * Associate the exact EC2 with the session.
       *
       * DO NOT change status to starting yet.
       * EBS may still be preparing.
       */
      const updatedSession = await GameSession.findByIdAndUpdate(
        scalingSession._id,
        {
          $set: {
            instanceId: lease.instanceId || instanceId,
            instanceIp: lease.instanceIp,
            leaseToken: lease.leaseToken,
            leaseExpiresAt: lease.leaseExpiresAt 
              ? new Date(lease.leaseExpiresAt * 1000) 
              : null,
            "storage.availabilityZone": lease.availabilityZone || null,
            leasing: false,
          },
        },
        { new: true }
      );

      createSessionStorage(
        updatedSession._id
      )
        .then(() =>
          tryFinalizeSessionAllocation(
            updatedSession._id
          )
        )
        .catch(error => {
          console.error(
            `[Instance Ready] Storage provisioning failed ` +
            `session=${updatedSession._id}:`,
            error
          );
        });

      log(
        `[Instance Ready] GPU associated with session ${updatedSession._id} ` +
        `instance=${instanceId} AZ=${lease.availabilityZone || "unknown"}`
      );

      /*
       * ----------------------------------------------------------
       * IMPORTANT
       *
       * We intentionally DO NOT:
       *   status = starting
       *   phase = downloading
       *   callController()
       *
       * EBS preparation is running independently.
       *
       * The allocation coordinator will finalize the session
       * when:
       *   GPU lease = ready
       *   EBS volume = ready
       *
       * This is the core of the parallel architecture.
       */

      return res.json({
        assigned: true,
        sessionId: updatedSession._id,
        instanceId,
        status: "waiting",
        allocationType: "scaling",
        gpuReady: true,
        storageReady: updatedSession.storage?.status === "ready",
      });
    }

    /*
     * ------------------------------------------------------------
     * STEP 4
     * No scaling session matched this worker.
     *
     * This can happen when the instance was created as capacity
     * for a QUEUED request rather than a direct scaling request.
     *
     * Find the oldest actual queued session.
     */
    const queuedSession = await GameSession.findOneAndUpdate(
      {
        status: "waiting",
        queueType: "queued",
        "allocation.type": "queued",
        instanceRegion: region,
        endedAt: null,
        leasing: false,
      },
      {
        $set: {
          leasing: true,
          lastAllocationAttempt: new Date(),
        },
      },
      {
        sort: { createdAt: 1 },
        new: true,
      }
    );

    if (!queuedSession) {
      log(`[Instance Ready] No waiting session requires instance=${instanceId} region=${region}`);
      return res.json({
        assigned: false,
        reason: "no_waiting_session",
        instanceId,
      });
    }

    /*
     * ------------------------------------------------------------
     * STEP 5
     * Queue allocation also leases the exact newly-ready worker.
     */
    const lease = await leaseSpecificInstance(instanceId, region);

    if (lease.status !== "ASSIGNED") {
      await GameSession.findByIdAndUpdate(queuedSession._id, {
        $set: { leasing: false },
      });

      return res.json({
        assigned: false,
        reason: lease.status,
        instanceId,
      });
    }

    /*
     * ------------------------------------------------------------
     * STEP 6
     * Associate GPU with queued session.
     *
     * Storage still has to become ready before the game can
     * actually start.
     */
    const now = new Date();
    const countdownSeconds = 30;
    const countdownStartsAt = new Date(now.getTime() + 5000);
    const allocationExpiresAt = new Date(countdownStartsAt.getTime() + (countdownSeconds * 1000));

const updatedQueuedSession =
  await GameSession.findByIdAndUpdate(
    queuedSession._id,
    {
      $set: {
        instanceId:
          lease.instanceId || instanceId,

        instanceIp:
          lease.instanceIp || null,

        leaseToken:
          lease.leaseToken,

        leaseExpiresAt:
          lease.leaseExpiresAt
            ? new Date(
                lease.leaseExpiresAt * 1000
              )
            : null,

        instanceRegion: region,

        "storage.availabilityZone":
          lease.availabilityZone || null,

        leasing: false,
      },
    },
    {
      new: true,
    }
  );

if (!updatedQueuedSession) {
  return res.status(404).json({
    assigned: false,
    reason: "session_not_found",
  });
}

/*
 * Start storage creation.
 *
 * Do NOT start countdown yet.
 *
 * tryFinalizeSessionAllocation() will move
 * waiting -> allocation_ready only after:
 *
 *   GPU = ready
 *   EBS = ready
 */
createSessionStorage(
  updatedQueuedSession._id
)
  .then(() =>
    tryFinalizeSessionAllocation(
      updatedQueuedSession._id
    )
  )
  .catch(error => {
    console.error(
      `[Instance Ready] Queued storage failed ` +
      `session=${updatedQueuedSession._id}:`,
      error
    );
  });

log(
  `[Instance Ready] Queued session ` +
  `${updatedQueuedSession._id} associated with ` +
  `instance=${instanceId}; waiting for EBS`
);

return res.json({
  assigned: true,
  sessionId: updatedQueuedSession._id,
  instanceId,
  wasQueued: true,
  status: "waiting",
  gpuReady: true,
  storageReady: false,
});
    
  } catch (err) {
    console.error("[Instance Ready] Error:", err);

    /*
     * If we claimed a session with leasing=true and then failed,
     * a cleanup/reconciliation process should be able to recover.
     */
    return res.status(500).json({
      error: "Internal error",
      message: err.message,
    });
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
const { status, error } = req.body;  

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
        if (!session.exitReason) {
          updates.exitReason = "error";
        }

        if (session.instanceId && session.leaseToken) {
          try {
            const releaseResult = await releaseInstance(session.instanceId, session.leaseToken, session.instanceRegion);
            const token = await cacheService.get(`streamtoken:${sessionId}`);

            reconcileCapacity(session.instanceRegion).catch(console.error);

            try {
              await deleteSessionStorage(
                sessionId
              );
            } catch (storageErr) {
              console.error(
                "[Session Update] Storage cleanup failed:",
                storageErr
              );
            }

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

          // Only assign user_exit if no reason has already been recorded.
          if (!session.exitReason) {
            updates.exitReason = "user_exit";
          }   

        if (session.instanceId && session.leaseToken) {
          try {
            const releaseResult = await releaseInstance(session.instanceId, session.leaseToken, session.instanceRegion);
            const token = await cacheService.get(`streamtoken:${sessionId}`);

            reconcileCapacity(session.instanceRegion).catch(console.error);

            try {
                await deleteSessionStorage(
                  sessionId
                );
              } catch (storageErr) {
                console.error(
                  "[Session Update] Storage cleanup failed:",
                  storageErr
                );
              }

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
 * Called by FRONTEND when user clicks LAUNCH
 *
 * Atomically transitions:
 *
 * allocation_ready -> starting
 *
 * ONLY if allocation has not expired.
 */
router.post("/session/launch", async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: "sessionId required",
      });
    }

    /*
     * IMPORTANT:
     *
     * This is intentionally one atomic MongoDB operation.
     *
     * If the cleanup worker has already expired the allocation,
     * this query will not match.
     *
     * If this query succeeds, the launch wins the race.
     */
const now = new Date();

// Allow 3 seconds of grace for network/server latency.
// This is important when the user clicks Launch near the
// end of the countdown.

const launchCutoff = new Date(
  now.getTime() - ALLOCATION_GRACE_MS
);

const updatedSession =
  await GameSession.findOneAndUpdate(
    {
      _id: sessionId,
      status: "allocation_ready",
      allocationExpiresAt: {
        $gt: launchCutoff,
      },
    },
        {
          $set: {
            status: "starting",
            phase: "downloading",
          },

          $unset: {
            allocationExpiresAt: "",
            countdownStartsAt: "",
            countdownSeconds: "",
          },
        },
        {
          new: true,
        }
      );

    /*
     * No match means one of:
     *
     * - session doesn't exist
     * - user already launched
     * - user cancelled
     * - allocation expired
     * - cleanup worker already claimed it
     */
    if (!updatedSession) {
      const existingSession =
        await GameSession.findById(sessionId)
          .select("status allocationExpiresAt")
          .lean();

      if (!existingSession) {
        return res.status(404).json({
          error: "Session not found",
        });
      }

      if (
        existingSession.status ===
        "allocation_ready"
      ) {
        return res.status(410).json({
          error: "allocation_expired",
          message:
            "The launch window has expired.",
        });
      }

      return res.status(409).json({
        error: `Cannot launch from status ${existingSession.status}`,
      });
    }

    /*
     * Notify connected frontend immediately.
     */
    const send = sessionStreams.get(
      sessionId.toString()
    );

    if (send) {
      send({
        status: "starting",
        phase: "downloading",
      });
    }

    /*
     * Start the instance.
     */
    await callController(updatedSession, {
      id: updatedSession.instanceId,
      ip: updatedSession.instanceIp,
      leaseToken: updatedSession.leaseToken,
    });

    /*
     * Publish event for other backend processes.
     */
    try {
      await publishSessionEvent(sessionId, {
        status: "starting",
        phase: "downloading",
      });
    } catch (err) {
      console.warn(
        "[Session Launch] PubSub publish failed:",
        err.message
      );
    }

    log(
      `[Session Launch] Started session ${sessionId} after countdown`
    );

    return res.json({
      ok: true,
      status: "starting",
    });

  } catch (err) {
    console.error(
      "[Session Launch] Error:",
      err
    );

    return res.status(500).json({
      error: "Internal error",
    });
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