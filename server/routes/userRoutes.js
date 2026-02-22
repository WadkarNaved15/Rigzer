import express from "express";
import User from "../models/User.js";  // adjust path if needed

const router = express.Router();

// GET all users
router.get("/", async (req, res) => {
  try {
    const users = await User.find({}, "username email avatar"); 
    // second arg selects only certain fields, you can add more if needed
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
