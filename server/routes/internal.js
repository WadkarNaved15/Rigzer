import express from "express";
import GameSession from "../models/GameSession.js";
import { publishSessionEvent } from "../services/sessionPubSub.js";
import { releaseInstance } from "../services/instanceAllocator.js";

const router = express.Router();

/**
 * POST /api/internal/sessions/update
 * Called by Session Controller to update session status
 * This is the webhook endpoint that receives notifications from the controller
 */
router.post("/sessions/update", async (req, res) => {
  try {
    // Verify API key
    // const apiKey = req.headers.authorization?.replace("Bearer ", "");
    // if (apiKey !== process.env.INSTANCE_BACKEND_KEY) {
    //   console.warn("[Session Update] Unauthorized request");
    //   return res.status(401).json({ error: "Unauthorized" });
    // }

    const { sessionId, status, error } = req.body;

    console.log("[Session Update]", req.body);

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId required" });
    }

    const session = await GameSession.findById(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Build updates based on status from controller
    const updates = {};

    switch (status) {
      case "provisioning":
      case "downloading":
        updates.phase = "downloading";
        break;

      case "launching":
        updates.phase = "launching";
        updates.status = "starting";
        break;

      case "running":
        updates.status = "running";
        updates.phase = null;
        if (!session.startedAt) {
          updates.startedAt = new Date();
        }
        break;

      case "failed":
        updates.status = "failed";
        updates.error = error || "Session failed";
        updates.endedAt = new Date();
        updates.phase = null;

        // Release instance on failure
        if (session.instanceId) {
          releaseInstance(session.instanceId).catch((err) =>
            console.error("Failed to release instance:", err)
          );
        }
        break;

      case "ended":
        updates.status = "ended";
        updates.endedAt = new Date();
        updates.phase = null;

        // Release instance on end
        if (session.instanceId) {
          releaseInstance(session.instanceId).catch((err) =>
            console.error("Failed to release instance:", err)
          );
        }
        break;

      default:
        console.warn(`[Session Update] Unknown status: ${status}`);
    }

    // Apply updates to database
    const updatedSession = await GameSession.findByIdAndUpdate(
      sessionId,
      updates,
      { new: true }
    );

    // Publish event to Redis (for SSE fan-out)
    await publishSessionEvent(sessionId, {
      status: updatedSession.status,
      phase: updatedSession.phase,
    });

    console.log(
      `[Session Update] ${sessionId}: ${updatedSession.status}/${updatedSession.phase}`
    );

    return res.json({ ok: true, message: "Session updated" });
  } catch (err) {
    console.error("[Session Update] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;