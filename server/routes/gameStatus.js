import express from "express";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

// In-memory session storage
let sessions = {};

const GAME_STEPS = [
  "starting_server",
  "initializing_game",
  "initializing_stream",
  "setting_up_input",
  "ready"
];

// ------------------------------
// POST /api/game/start
// ------------------------------
router.post("/start", (req, res) => {
  const sessionId = uuidv4();

  sessions[sessionId] = {
    stepIndex: 0,
    step: GAME_STEPS[0],
  };

  console.log(`🎮 New session started: ${sessionId}`);

  // Auto-progress steps every 2 seconds
  let interval = setInterval(() => {
    const s = sessions[sessionId];
    if (!s) return clearInterval(interval);

    if (s.stepIndex < GAME_STEPS.length - 1) {
      s.stepIndex++;
      s.step = GAME_STEPS[s.stepIndex];
    } else {
      clearInterval(interval);
    }
  }, 2000);

  res.json({ sessionId, status: "starting" });
});

// ------------------------------
// GET /api/game/status/:sessionId
// ------------------------------
router.get("/status/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  if (!sessions[sessionId]) {
    return res.status(404).json({ error: "Session not found" });
  }

  res.json({
    step: sessions[sessionId].step,
    progress: Math.round(
      ((sessions[sessionId].stepIndex + 1) / GAME_STEPS.length) * 100
    ),
  });
});

export default router;
