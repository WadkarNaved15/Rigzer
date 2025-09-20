// routes/userRoutes.js
import express from "express";
import User from "../models/User.js";

const router = express.Router();

// Search users by username
router.get("/", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim() === "") {
      return res.json([]); // return empty if query is empty
    }

    // Case-insensitive search with regex
    const users = await User.find({
      username: { $regex: q, $options: "i" },
    }).limit(5); // limit suggestions

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
