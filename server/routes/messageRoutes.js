import express from "express";
import Message from "../models/Message.js";
import Chat from "../models/Chat.js";
import verifyToken from "../middlewares/authMiddleware.js";

const router = express.Router();

// Send a message
router.post("/", verifyToken,async (req, res) => {
  try {
    const senderId = req.user.id;
    const { chatId, text } = req.body;

    const message = await Message.create({
      chatId,
      senderId,
      text,
    });

    res.json(message);
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ message: "Failed to send message" });
  }
});
// Get all messages for a chat
router.get("/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;

    const messages = await Message.find({ chatId })
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error("Fetch messages error:", err);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

export default router;
