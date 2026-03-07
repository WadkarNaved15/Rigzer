// routes/searchRoutes.js

import express from "express";
import User from "../models/User.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === "") {
      return res.json([]);
    }

    const users = await User.find({
      username: { $regex: `^${q}`, $options: "i" },
    })
      .select("username avatar")
      .limit(8)
      .lean();

    res.json(users);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;