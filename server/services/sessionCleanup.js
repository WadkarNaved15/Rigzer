import cron from "node-cron";
import fetch from "node-fetch";
import GameSession from "../models/GameSession.js";
import cacheService from "./cacheService.js";

/**
 * Background worker for cleaning up expired sessions
 * Runs periodically to end sessions that have exceeded their time limit
 */
export class SessionCleanupWorker {
  constructor() {
    this.isRunning = false;
    this.cleanupJob = null;
  }

  /**
   * Start the cleanup worker
   * Runs every 2 minutes
   */
  start() {
    if (this.isRunning) {
      console.log("[SessionCleanup] Worker already running");
      return;
    }

    console.log("[SessionCleanup] Starting cleanup worker");
    this.isRunning = true;

    // Run every 2 minutes
    this.cleanupJob = cron.schedule("*/2 * * * *", async () => {
      await this.cleanup();
    });

    // Also run immediately on start
    this.cleanup();
  }

  /**
   * Stop the cleanup worker
   */
  stop() {
    if (this.cleanupJob) {
      this.cleanupJob.stop();
      this.cleanupJob = null;
    }
    this.isRunning = false;
    console.log("[SessionCleanup] Worker stopped");
  }

  /**
   * Main cleanup logic
   */
  async cleanup() {
    try {
      console.log("[SessionCleanup] Running cleanup...");

      // Find expired sessions
      const expiredSessions = await GameSession.findExpiredSessions();

      console.log(`[SessionCleanup] Found ${expiredSessions.length} expired sessions`);

      // Process each expired session
      const results = await Promise.allSettled(
        expiredSessions.map((session) => this.endSession(session))
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      console.log(
        `[SessionCleanup] Cleanup complete: ${succeeded} ended, ${failed} failed`
      );

      // Also cleanup orphaned sessions (running for too long)
      await this.cleanupOrphans();

    } catch (err) {
      console.error("[SessionCleanup] Cleanup error:", err);
    }
  }

  /**
   * End a single session
   */
  async endSession(session) {
    try {
      console.log(`[SessionCleanup] Ending session ${session._id}`);

      // Notify instance to stop
      if (session.instanceIp) {
        try {
          await fetch(`http://${session.instanceIp}:8080/stop-session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: session._id.toString(),
              reason: "expired",
            }),
            timeout: 5000,
          });
        } catch (err) {
          console.log(`[SessionCleanup] Failed to notify instance: ${err.message}`);
          // Continue anyway
        }
      }

      // Update session status
      session.status = "ended";
      session.endedAt = new Date();
      
      if (!session.metrics) {
        session.metrics = {};
      }
      session.metrics.totalPlayTime = session.actualDuration;

      await session.save();

      // Clear from cache
      await cacheService.deleteActiveSession(session._id.toString());

      console.log(`[SessionCleanup] Session ${session._id} ended successfully`);

    } catch (err) {
      console.error(`[SessionCleanup] Failed to end session ${session._id}:`, err);
      throw err;
    }
  }

  /**
   * Cleanup orphaned sessions (running for > 6 hours)
   */
  async cleanupOrphans() {
    try {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

      const orphans = await GameSession.find({
        status: { $in: ["starting", "running"] },
        createdAt: { $lt: sixHoursAgo },
      });

      if (orphans.length > 0) {
        console.log(`[SessionCleanup] Found ${orphans.length} orphaned sessions`);

        for (const session of orphans) {
          session.status = "failed";
          session.endedAt = new Date();
          await session.save();
          await cacheService.deleteActiveSession(session._id.toString());
        }
      }
    } catch (err) {
      console.error("[SessionCleanup] Orphan cleanup error:", err);
    }
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      running: this.isRunning,
      nextRun: this.cleanupJob?.nextDate?.().toISOString() || null,
    };
  }
}

// Export singleton instance
export const cleanupWorker = new SessionCleanupWorker();

export default cleanupWorker;