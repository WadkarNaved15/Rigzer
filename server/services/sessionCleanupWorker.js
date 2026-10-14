/**
 * Game Session Cleanup Worker
 *
 * This should run as a SEPARATE process (e.g., via cron, systemd timer, or Kubernetes job).
 * DO NOT run this inside your main API servers.
 *
 * It uses a distributed lock in Redis to ensure only ONE instance cleans at a time.
 * Uses the same Redis configuration as your main server.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import redisClient from "../config/redis.js";
import fetch from "node-fetch";
import GameSession from "../models/GameSession.js";
import { finalizeSession } from "../helper/session.js";
import { deleteSessionStorage } from "./sessionStorage.js";
import { ALLOCATION_GRACE_MS } from "../helper/session.js";

dotenv.config();

const LOCK_KEY = "cleanup:lock";
const LOCK_TTL = 120; // seconds
const CLEANUP_INTERVAL = 60_000; // 60 seconds
const ENDING_TIMEOUT_MS = 3 * 60_000; // 3 minutes

// Allow Launch requests a small amount of time
// to reach the backend after the allocation expires.

/**
 * Attempt to acquire a distributed lock in Redis
 *
 * Returns lock ID if successful, null if lock is held by another process.
 */
async function acquireLock() {
  try {
    const lockId = `worker-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const acquired = await redisClient.set(LOCK_KEY, lockId, {
      NX: true,
      EX: LOCK_TTL,
    });

    return acquired ? lockId : null;
  } catch (err) {
    console.error("❌ Error acquiring lock:", err);
    return null;
  }
}

/**
 * Release the distributed lock
 */
async function releaseLock(lockId) {
  try {
    const current = await redisClient.get(LOCK_KEY);

    if (current === lockId) {
      await redisClient.del(LOCK_KEY);
    }
  } catch (err) {
    console.error("❌ Error releasing lock:", err);
  }
}

/**
 * Retry AWS EBS cleanup for sessions that have already ended.
 *
 * IMPORTANT:
 *
 * This function is ONLY responsible for AWS-side storage cleanup.
 *
 * It does NOT:
 * - stop the game
 * - release the GPU instance
 * - reconcile capacity
 * - change the session lifecycle
 *
 * By the time a session reaches "ended", the Rust controller should
 * already have:
 *
 *   1. stopped the game/supervisor
 *   2. waited for the processes to exit
 *   3. dismounted the session EBS volume from Windows
 *   4. verified that the mount point is free
 *   5. notified the backend with "ended_and_ready"
 *
 * Therefore AWS detach/delete can safely be retried independently.
 */
async function retryFailedStorageCleanup() {
  try {
    const sessions = await GameSession.find({
      status: "ended",
      "storage.status": {
        $in: [
          "pending",
          "creating",
          "attaching",
          "ready",
          "detaching",
          "detached",
          "failed",
        ],
      },
      "storage.volumeId": {
        $exists: true,$ne: null,
      },
    })
      .select("_id storage status endedAt")
      .limit(50);

    if (sessions.length === 0) {
      return;
    }

    console.log(
      `[Cleanup] Found ${sessions.length} ended session(s) with pending storage cleanup`
    );

    for (const session of sessions) {
      try {
        console.log(
          `[Cleanup] Retrying storage cleanup for ended session ${session._id} ` +
          `(storage=${session.storage?.status}, volume=${session.storage?.volumeId})`
        );

        await deleteSessionStorage(session._id);

        console.log(`[Cleanup] ✓ Storage cleanup completed for session ${session._id}`);
      } catch (err) {
        /*
         * Do NOT fail the entire cleanup cycle because one EBS
         * volume could not be cleaned up.
         *
         * The session remains eligible for another retry on the
         * next cleanup-worker cycle.
         */
        console.warn(
          `[Cleanup] ⚠ Storage cleanup retry failed for session ${session._id}:`,
          err.message
        );
      }
    }
  } catch (err) {
    console.error("[Cleanup] Failed while scanning for failed storage cleanup:", err);
  }
}



async function recoverStuckEndingSessions() {
  try {
    const cutoff = new Date(Date.now() - ENDING_TIMEOUT_MS);

    const sessions = await GameSession.find({
      status: "ending",
      endingAt: {
        $lte: cutoff,
      },
    })
      .select(
        "_id instanceId instanceIp instanceRegion leaseToken exitReason endingAt"
      )
      .limit(50);

    if (sessions.length === 0) {
      return;
    }

    console.log(
      `[Cleanup] Found ${sessions.length} stuck ending session(s)`
    );

    for (const session of sessions) {
      try {
        /*
         * Give Rust another chance to complete the normal
         * shutdown -> dismount -> ended_and_ready flow.
         */
        if (session.instanceIp) {
          try {
            await fetch(
              `http://${session.instanceIp}:4443/stop-session`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  session_id: session._id.toString(),
                }),
                timeout: 5000,
              }
            );

            console.log(
              `[Cleanup] Retried stop for stuck session ${session._id}`
            );

            /*
             * Controller responded, so leave the session alone.
             *
             * Rust should finish the shutdown and send
             * ended_and_ready.
             */
            continue;
          } catch (err) {
            console.warn(
              `[Cleanup] Controller unreachable for stuck session ` +
              `${session._id}: ${err.message}`
            );
          }
        }

        /*
         * IMPORTANT:
         *
         * Do not release the GPU merely because the HTTP request
         * failed. A network failure does not prove the EC2 worker
         * is dead.
         *
         * The confirmed-dead-worker recovery should be handled
         * using the worker heartbeat/DynamoDB state.
         */
        console.warn(
          `[Cleanup] Stuck session ${session._id} requires worker-health ` +
          `verification before GPU release`
        );
      } catch (err) {
        console.error(
          `[Cleanup] Failed recovering stuck session ${session._id}:`,
          err.message
        );
      }
    }
  } catch (err) {
    console.error(
      "[Cleanup] Failed while recovering stuck ending sessions:",
      err
    );
  }
}

/**
 * Clean up stale game sessions
 */
async function cleanupStaleSessions(lockId) {
  try {
    /*
     * ------------------------------------------------------------
     * STEP 1:
     * Retry AWS storage cleanup from previously ended sessions.
     *
     * This MUST happen before checking stale sessions because there
     * may be no stale sessions while old EBS cleanup still needs
     * another attempt.
     * ------------------------------------------------------------
     */
    await retryFailedStorageCleanup();
    await recoverStuckEndingSessions();

    const now = new Date();
    const staleThreshold = new Date(Date.now() - 90_000);

    // Cleanup only after the launch grace period has also expired.
    const allocationCleanupCutoff = new Date(now.getTime() - ALLOCATION_GRACE_MS);

    /*
     * ------------------------------------------------------------
     * STEP 2:
     * Find stale-session candidates.
     *
     * We CLAIM each session atomically below before doing any
     * cleanup.
     * ------------------------------------------------------------
     */
    const staleSessions = await GameSession.find({
      $or: [
        // 1. Explicit browser/tab disconnect that was not recovered
        {
          status: { $in: ["waiting", "starting", "running"] },
          disconnectDeadline: { $lte: now },
        },
        // 2. Fallback for sessions whose heartbeat stopped
        {
          status: { $in: ["waiting", "starting", "running"] },
          lastHeartbeat: { $lt: staleThreshold },
        },
        // 3. Allocation countdown expired
        {
          status: "allocation_ready",
          allocationExpiresAt: { $lte: allocationCleanupCutoff },
        },
      ],
    });

    if (staleSessions.length === 0) {
      return;
    }

    console.log(`[Cleanup ${lockId.substring(0, 8)}...] Found ${staleSessions.length} stale session(s)`);

    let cleanedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    /*
     * ------------------------------------------------------------
     * STEP 3:
     * Process each stale session.
     * ------------------------------------------------------------
     */
    for (const candidate of staleSessions) {
      try {
        /*
         * IMPORTANT:
         *
         * Atomically claim the session before doing anything.
         *
         * This prevents a race with:
         * - user Launch
         * - user Cancel
         * - instance controller
         * - another cleanup worker
         */
        const allocationExpired =
          candidate.status === "allocation_ready" &&
          candidate.allocationExpiresAt &&
          candidate.allocationExpiresAt <= allocationCleanupCutoff;

        const cleanupReason = allocationExpired ? "countdown_expired" : "user_abandoned";
        let claimFilter;

        if (allocationExpired) {
          claimFilter = {
            _id: candidate._id,
            status: "allocation_ready",
            allocationExpiresAt: { $lte: allocationCleanupCutoff },
          };
        } else if (candidate.disconnectDeadline && candidate.disconnectDeadline <= now) {
          claimFilter = {
            _id: candidate._id,
            status: candidate.status,
            disconnectDeadline: { $lte: now },
          };
        } else {
          claimFilter = {
            _id: candidate._id,
            status: candidate.status,
            lastHeartbeat: { $lt: staleThreshold },
          };
        }

        const claimedSession = await GameSession.findOneAndUpdate(
          claimFilter,
          {
            $set: {
              status: "ending",
              exitReason: cleanupReason,
              endingAt: new Date(),
            },
            $unset: {
              disconnectDeadline: "",
            },
          },
          { new: true }
        );

        /*
         * Someone else changed the session first.
         *
         * DO NOT touch the instance or finalize it.
         */
        if (!claimedSession) {
          console.log(`[Cleanup] Skipping ${candidate._id} - session already handled`);
          skippedCount++;
          continue;
        }

        console.log(`[Cleanup] Claimed session ${claimedSession._id} as ${cleanupReason}`);

        /*
         * --------------------------------------------------------
         * STEP 4:
         * Ask the Rust controller to stop the session.
         *
         * Do NOT finalize the session here.
         *
         * Rust must first:
         *   - stop the supervisor/game
         *   - wait for the process to exit
         *   - dismount the session EBS volume
         *   - verify D: is free
         *   - notify backend with "ended_and_ready"
         *
         * The /sessions/update endpoint performs the actual
         * finalization and GPU release after that confirmation.
         * --------------------------------------------------------
         */
        if (claimedSession.instanceIp) {
          try {
            await fetch(`http://${claimedSession.instanceIp}:4443/stop-session`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                session_id: claimedSession._id.toString(),
              }),
              timeout: 5000,
            });

            console.log(`[Cleanup] ✓ Stop requested for instance: ${claimedSession.instanceIp}`);
          } catch (err) {
            /*
             * Do NOT finalize or release the GPU.
             *
             * We cannot prove that the game stopped or that D:
             * was dismounted.
             */
            console.warn(
              `[Cleanup] ⚠ Failed to stop instance for session ${claimedSession._id}:`,
              err.message
            );
            continue;
          }
        }

        /*
         * Controller-backed sessions are intentionally left in "ending".
         *
         * Rust will call /sessions/update with "ended_and_ready"
         * after the Windows-side cleanup is complete.
         *
         * That endpoint then:
         *   1. finalizeSession()
         *   2. releaseInstance()
         *   3. start AWS storage cleanup
         *   4. reconcile capacity
         */
        console.log(
          `[Cleanup] Session ${claimedSession._id} is ending; ` +
          `waiting for ended_and_ready before finalization/release`
        );

        cleanedCount++;
      } catch (err) {
        console.error(`[Cleanup] ❌ Error cleaning session ${candidate._id}:`, err.message);
        errorCount++;
      }
    }

    console.log(
      `[Cleanup ${lockId.substring(0, 8)}...] Cleanup complete: ` +
      `${cleanedCount} cleaned, ${skippedCount} skipped, ${errorCount} errors`
    );
  } catch (err) {
    console.error(`[Cleanup] Fatal error during cleanup:`, err);
  }
}


/**
 * Main loop - runs cleanup at intervals with distributed lock
 */
async function startCleanupWorker() {
  try {
    console.log("🚀 Cleanup worker started\n");

    const cleanupInterval = setInterval(async () => {
      const lockId = await acquireLock();

      if (!lockId) {
        return;
      }

      try {
        await cleanupStaleSessions(lockId);
        
      } finally {
        await releaseLock(lockId);
      }
    }, CLEANUP_INTERVAL);

    process.on("SIGTERM", async () => {
      clearInterval(cleanupInterval);
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      clearInterval(cleanupInterval);
      process.exit(0);
    });
  } catch (err) {
    console.error("❌ Startup failed:", err);
    process.exit(1);
  }
}

export default startCleanupWorker;