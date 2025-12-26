// routes/interactions.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import UserInteraction from "../models/UserInteraction.js";
// import { updateInteraction } from "../helper/interactionController.js";
const router = express.Router();

router.post("/view", auth, async (req, res) => {
  try {
    const { postId } = req.body;
    const userId = req.user.id;

    // await updateInteraction(userId, postId, { viewedAt: new Date() });

    res.json({ message: "View updated" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});
router.post("/playtime-start", auth, async (req, res) => {
  try {
    const { postId } = req.body;
    const userId = req.user.id;   
    console.log("playtime start");
     // Only ensure document exists. Do NOT reset playTime!
    // await UserInteraction.findOneAndUpdate(
    //   { user: userId, post: postId },
    //   { $setOnInsert: { playTime: 0 } },
    //   { upsert: true }
    // );

    res.json({ message: "playtime session started" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
router.post("/playtime-end", auth, async (req, res) => {
  try {
    const { postId, duration } = req.body;
    console.log("Duration received:", duration, "Post:", postId);
    const userId = req.user.id;
    //  await UserInteraction.findOneAndUpdate(
    //   { user: userId, post: postId },
    //   { $inc: { playTime: duration } },
    //   { upsert: true }
    // );

    res.json({ message: "playtime recorded", duration });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
router.post("/played-demo", auth, async (req, res) => {
  try {
    const { postId } = req.body;
    const userId = req.user.id;

    // const updated = await updateInteraction(userId, postId, { playedDemo: true });

    res.json({ success: true, interaction: updated });
  } catch (err) {
    console.error("playedDemo error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});



export default router;
