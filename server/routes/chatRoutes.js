import express from "express";
import Chat from "../models/Chat.js";
import verifyToken from "../middlewares/authMiddleware.js";

const router = express.Router();

// Start or get chat between current user & receiver
router.post("/start", verifyToken, async (req, res) => {
  try {
    const senderId = req.user.id; // from auth middleware
    const { receiverId } = req.body;
    if (senderId === receiverId) {
      return res.status(400).json({ message: "Cannot chat with yourself" });
    }
    // ALWAYS sort participants to maintain consistency
    const participants = [senderId, receiverId].sort();

    // Find existing chat
    let chat = await Chat.findOne({
      participants: participants
    });
    console.log("chat", chat);
    console.log("Chat is found");
    // Create if not exists
    // if (!chat) {
    //   chat = await Chat.create({
    //     participants
    //   });
    // }

    res.json(chat || null);
  } catch (err) {
    console.error("Chat start error:", err);
    res.status(500).json({ message: "Failed to start chat" });
  }
});

router.get("/my-chats", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("My chats request received");
    const chats = await Chat.find({
      participants: userId
    }).populate("participants", "username avatar");

    // 🔥 Format response → return ONLY other user
    const formatted = chats.map(chat => {
      const otherUser = chat.participants.find(
        (p) => p._id.toString() !== userId.toString()
      );

      return {
        chatId: chat._id,
        user: {
          id: otherUser._id,
          name: otherUser.username,
          avatar: otherUser.avatar
        }
      };
    });

    res.json(formatted);

  } catch (err) {
    console.error("Fetch chats error:", err);
    res.status(500).json({ message: "Failed to fetch chats" });
  }
});

export default router;