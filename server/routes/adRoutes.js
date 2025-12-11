import express from "express";
import Ad from "../models/Ad.js";

const router = express.Router();

// ===============================
// CREATE NEW AD (Admin Only)
// ===============================
router.post("/", async (req, res) => {
  try {
    const ad = await Ad.create(req.body);
    res.status(201).json(ad);
  } catch (err) {
    res.status(500).json({ error: "Failed to create ad", details: err.message });
  }
});

// ===============================
// GET RANDOM ACTIVE AD
// ===============================
router.get("/fairadd", async (req, res) => {
    try {
    const ad = await Ad.findOne({ isActive: true }).sort({ impressions: 1 });

    if (!ad) return res.status(404).json({ message: "No ads found" });

    await Ad.findByIdAndUpdate(ad._id, {
      $inc: { impressions: 1 },
    });
    res.json(ad);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// ===============================
// TRACK CLICK EVENT
// ===============================
router.post("/click/:id", async (req, res) => {
  try {
    await Ad.findByIdAndUpdate(req.params.id, {
      $inc: { clicks: 1 }
    });

    res.json({ message: "Click recorded" });
  } catch (err) {
    res.status(500).json({ error: "Failed to track click", details: err.message });
  }
});

export default router;
