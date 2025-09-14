import express from "express";
import verifyToken from "../middlewares/authMiddleware.js";
import Feedback from "../models/Feedback.js";

const router = express.Router();

// POST - Submit feedback
// POST - Submit feedback
router.post("/", verifyToken, async (req, res) => {
  try {
    const { category, message } = req.body;

    if (!category || !message) {
      return res.status(400).json({ error: "Category and message are required" });
    }

    const feedback = new Feedback({
      user: req.user.id, // Now this will work because verifyToken sets req.user
      category,
      message,
    });

    await feedback.save();

    console.log("Feedback received", { category, message });
    res.status(201).json({
      message: "Feedback received successfully",
      data: feedback,
    });
  } catch (error) {
    console.error("Feedback error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// GET - Get all feedback (for admin)
router.get("/", verifyToken, async (req, res) => {
  try {
    const feedbacks = await Feedback.find().populate("user", "username email");
    res.status(200).json(feedbacks);
  } catch (error) {
    console.error("Fetch feedback error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
