import express from "express";
import Message from "../models/Message.js";
import Chat from "../models/Chat.js";
import verifyToken from "../middlewares/authMiddleware.js";
import mongoose from "mongoose";
const router = express.Router();

// Send a message
router.post("/", verifyToken,async (req, res) => {
  try {
    const senderId = req.user.id;
    const { chatId, text } = req.body;

    const message = await Message.create({
      chatId,
      senderId,
      receiverId,
      text,
      seen: false
    });

    res.json(message);
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ message: "Failed to send message" });
  }
});
// Get unread message counts
router.get("/unread-counts", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Count unseen messages grouped by sender
    const unread = await Message.aggregate([
      {
        $match: {
          receiverId: new mongoose.Types.ObjectId(userId),
          seen: false,
        },
      },
      {
        $group: {
          _id: "$senderId",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json(unread);
  } catch (err) {
    console.error("Unread count error:", err);
    res.status(500).json({ message: "Failed to fetch unread counts" });
  }
});

// Mark messages as seen
router.put("/seen/:chatId", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { chatId } = req.params;

  await Message.updateMany(
    {
      chatId,
      senderId: { $ne: userId }, // only messages from other person
      seen: false
    },
    {
      $set: { seen: true, seenAt: new Date() }
    }
  );

  res.json({ success: true });
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
// Share a post in a chat
router.post("/share-post", async (req, res) => {
  try {
    const { chatId, senderId, postId } = req.body;

    const message = await Message.create({
      chatId,
      senderId,
      messageType: "post",
      sharedPostId: postId
    });

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: "Failed to share post" });
  }
});


export default router;
