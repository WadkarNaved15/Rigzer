// routes/pockets.js

import express from "express";
import PocketFeedEntry from "../models/PocketFeedEntry.js";

const router = express.Router();

router.get("/fetch_pockets", async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const pockets = await PocketFeedEntry.find({})
      .populate("owner", "username avatar")
      .sort({ publishedAt: -1 })
      .limit(Number(limit))
      .lean();

    const formatted = pockets.map((e) => ({
      _id: e._id,
      user: e.owner,
      createdAt: e.createdAt,
      brandName: e.brandName,
      tagline: e.tagline,
      compiledBundleUrl: e.compiledBundleUrl,
    }));

    res.json({ pockets: formatted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch pockets" });
  }
});

export default router;