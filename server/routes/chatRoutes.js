import express from "express";
import Chat from "../models/Chat.js";
import verifyToken from "../middlewares/authMiddleware.js";

const router = express.Router();

// Start or get chat between current user & receiver
router.post("/start", verifyToken,async (req, res) => {
  try {
    const senderId = req.user.id; // from auth middleware
    const { receiverId } = req.body;

    // Check if chat already exists
    let chat = await Chat.findOne({
      participants: { $all: [senderId, receiverId] }
    });

    // If no chat exists, create one
    if (!chat) {
      chat = await Chat.create({
        participants: [senderId, receiverId],
      });
    }

    res.json(chat);
  } catch (err) {
    console.error("Chat start error:", err);
    res.status(500).json({ message: "Failed to start chat" });
  }
});

export default router;