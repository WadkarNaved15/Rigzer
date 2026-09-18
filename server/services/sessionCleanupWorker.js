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
import { releaseInstance } from "./instanceAllocator.js";
import { finalizeSession } from "../helper/session.js"; 
import { reconcileCapacity } from "./capacityReconciler.js";
import { deleteSessionStorage } from "./sessionStorage.js";
import { ALLOCATION_GRACE_MS } from "../helper/session.js";

dotenv.config();

const LOCK_KEY = "cleanup:lock";
const LOCK_TTL = 120; // seconds
const CLEANUP_INTERVAL = 60_000; // 60 seconds

// Allow Launch requests a small amount of time
// to reach the backend after the allocation expires.


/**
 * Attempt to acquire a distributed lock in Redis
 * Returns lock ID if successful, null if lock is held by another process
 */
async function acquireLock() {
  try {
    const lockId = `worker-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const acquired = await redisClient.set(
      LOCK_KEY,
      lockId,
      { NX: true, EX: LOCK_TTL }
    );
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
      // console.log(`✅ Lock released: ${lockId}`);
    }
  } catch (err) {
    console.error("❌ Error releasing lock:", err);
  }
}

/**
 * Clean up stale game sessions
 */
async function cleanupStaleSessions(lockId) {
  try {
    const now = new Date();
    const staleThreshold = new Date(Date.now() - 90_000);

    // Cleanup only after the launch grace period has also expired.
    const allocationCleanupCutoff = new Date(
      now.getTime() - ALLOCATION_GRACE_MS
    );

    // Find candidates only.
    // We CLAIM each session atomically below before doing any cleanup.
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
      allocationExpiresAt: {
        $lte: allocationCleanupCutoff,
      },
    },
  ],
});

    if (staleSessions.length === 0) {
      return;
    }

    console.log(
      `[Cleanup ${lockId.substring(0, 8)}...] Found ${staleSessions.length} stale session(s)`
    );

    let cleanedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const candidate of staleSessions) {
      try {
        /*
         * IMPORTANT:
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

const cleanupReason = allocationExpired
  ? "countdown_expired"
  : "user_abandoned";

let claimFilter;

if (allocationExpired) {
  claimFilter = {
    _id: candidate._id,
    status: "allocation_ready",
    allocationExpiresAt: {
      $lte: allocationCleanupCutoff,
    },
  };
} else if (
  candidate.disconnectDeadline &&
  candidate.disconnectDeadline <= now
) {
  claimFilter = {
    _id: candidate._id,
    status: candidate.status,
    disconnectDeadline: {
      $lte: now,
    },
  };
} else {
  claimFilter = {
    _id: candidate._id,
    status: candidate.status,
    lastHeartbeat: {
      $lt: staleThreshold,
    },
  };
}

const claimedSession = await GameSession.findOneAndUpdate(
  claimFilter,
  {
    $set: {
      status: "ending",
      exitReason: cleanupReason,
    },
    $unset: {
      disconnectDeadline: "",
    },
  },
  {
    new: true,
  }
);

        /*
         * Someone else changed the session first.
         * DO NOT touch the instance or finalize it.
         */
        if (!claimedSession) {
          console.log(
            `[Cleanup] Skipping ${candidate._id} - session already handled`
          );
          skippedCount++;
          continue;
        }

        console.log(
          `[Cleanup] Claimed session ${claimedSession._id} as ${cleanupReason}`
        );

        /*
         * Stop the game instance if it exists.
         */
        if (claimedSession.instanceIp) {
          try {
            await fetch(
              `http://${claimedSession.instanceIp}:4443/stop-session`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  session_id: claimedSession._id.toString(),
                }),
                timeout: 5000,
              }
            );

            console.log(
              `[Cleanup] ✓ Stopped instance: ${claimedSession.instanceIp}`
            );
          } catch (err) {
            console.warn(
              `[Cleanup] ⚠ Failed to stop instance for session ${claimedSession._id}:`,
              err.message
            );
          }
        }

        /*
         * Finalize using the reason that was atomically recorded.
         */
        await finalizeSession(
          claimedSession,
          cleanupReason
        );

        await deleteSessionStorage(claimedSession._id);

        /*
         * Release instance lease.
         */
        if (
          claimedSession.instanceId &&
          claimedSession.leaseToken
        ) {
          try {
            await releaseInstance(
              claimedSession.instanceId,
              claimedSession.leaseToken,
              claimedSession.instanceRegion
            );

            console.log(
              `[Cleanup] ✓ Released instance: ${claimedSession.instanceId}`
            );

            try {
              await reconcileCapacity(
                claimedSession.instanceRegion
              );

              console.log(
                `[Cleanup] ✓ Reconciled capacity for ${claimedSession.instanceRegion}`
              );
            } catch (err) {
              console.error(
                `[Cleanup] Failed to reconcile capacity for ${claimedSession.instanceRegion}:`,
                err
              );
            }
          } catch (err) {
            console.warn(
              `[Cleanup] ⚠ Failed to release instance ${claimedSession.instanceId}:`,
              err.message
            );
          }
        }

        console.log(
          `[Cleanup] ✅ Session ${claimedSession._id} cleaned up as ${cleanupReason}`
        );

        cleanedCount++;
      } catch (err) {
        console.error(
          `[Cleanup] ❌ Error cleaning session ${candidate._id}:`,
          err.message
        );

        errorCount++;
      }
    }

    console.log(
      `[Cleanup ${lockId.substring(0, 8)}...] Cleanup complete: ` +
      `${cleanedCount} cleaned, ` +
      `${skippedCount} skipped, ` +
      `${errorCount} errors`
    );
  } catch (err) {
    console.error(
      `[Cleanup] Fatal error during cleanup:`,
      err
    );
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
      if (!lockId) return;

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