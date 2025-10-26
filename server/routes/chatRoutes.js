import express from "express";
import Chat from "../models/Chat.js";
import verifyToken from "../middlewares/authMiddleware.js";

const router = express.Router();

// Get or create a chat between two users
router.post("/start", verifyToken, async (req, res) => {
  try {
    const { receiverId } = req.body;
    const senderId = req.user.id;

    // Check if chat already exists
    let chat = await Chat.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (!chat) {
      chat = await Chat.create({ participants: [senderId, receiverId] });
    }

    res.status(200).json(chat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error while starting chat" });
  }
});

export default router;
