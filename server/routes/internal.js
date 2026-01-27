// routes/interactions.js
import express from "express";
import GameSession from "../models/GameSession.js";
import { publishSessionEvent } from "../services/sessionPubSub.js";

const router = express.Router();


router.post("/sessions/update", async (req, res) => {
  const { sessionId, status, error } = req.body;

  console.log("req.body", req.body);
  const update = {};

  if (["starting", "running", "ended", "failed"].includes(status)) {
    update.status = status;
  }

  if (["downloading", "launching"].includes(status)) {
    update.phase = status;
  }

  if (status === "running") {
    update.startedAt = new Date();
    update.phase = null;
  }

  if (status === "ended") {
    update.endedAt = new Date();
    update.phase = null;
  }

  if (status === "failed") {
    update.error = error;
  }

  const session = await GameSession.findByIdAndUpdate(
    sessionId,
    update,
    { new: true }
  );

  // 🔥 REDIS EVENT (fan-out)
  await publishSessionEvent(sessionId, {
    status: session.status,
    phase: session.phase,
  });

  res.json({ ok: true });
});



export default router;
