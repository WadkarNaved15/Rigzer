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
router.get("/random", async (req, res) => {
  try {
    const now = new Date();

    const ads = await Ad.aggregate([
      {
        $match: {
          isActive: true,
          $or: [
            { endDate: null },
            { endDate: { $gte: now } }
          ]
        }
      },
      { $sample: { size: 1 } }
    ]);

    if (ads.length === 0)
      return res.status(404).json({ error: "No active ads found" });

    // Increase impression count
    await Ad.findByIdAndUpdate(ads[0]._id, {
      $inc: { impressions: 1 }
    });

    res.json(ads[0]);

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch ad", details: err.message });
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
