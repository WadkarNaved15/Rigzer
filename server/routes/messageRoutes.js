import express from "express";
import Message from "../models/Message.js";
import Chat from "../models/Chat.js";
import verifyToken from "../middlewares/authMiddleware.js";

const router = express.Router();

// Send a message
router.post("/", verifyToken, async (req, res) => {
  try {
    const { chatId, text } = req.body;
    const senderId = req.user.id;

    const message = await Message.create({
      chatId,
      sender: senderId,
      text,
    });

    // Update chat’s last message
    await Chat.findByIdAndUpdate(chatId, { lastMessage: message._id });

    res.status(201).json(message);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error while sending message" });
  }
});

// Get all messages for a chat
router.get("/:chatId", verifyToken, async (req, res) => {
  try {
    const messages = await Message.find({ chatId: req.params.chatId }).populate("sender", "name");
    res.status(200).json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error while fetching messages" });
  }
});

export default router;
