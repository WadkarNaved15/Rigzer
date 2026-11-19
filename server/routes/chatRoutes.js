import express from "express";
import Chat from "../models/Chat.js";
import verifyToken from "../middlewares/authMiddleware.js";

const router = express.Router();

// Start or get chat between current user & receiver

router.post("/start", verifyToken, async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({
        message: "Receiver ID is required",
      });
    }

    if (senderId.toString() === receiverId.toString()) {
      return res.status(400).json({
        message: "Cannot chat with yourself",
      });
    }

    // Sort participant IDs to generate a consistent chat key.
    const participants = [senderId.toString(), receiverId.toString()].sort();
    const chatKey = participants.join("_");

    // Find an existing chat or create a new pending chat.
const dbStart = performance.now();

const chat = await Chat.findOneAndUpdate(
  { chatKey },
  {
    $setOnInsert: {
      participants,
      chatKey,
      status: "pending",
      requestedBy: senderId,
    },
  },
  {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
    runValidators: true,
  }
)
  .select("_id status requestedBy")
  .lean();

console.log(
  `[CHAT PERF] Chat database operation: ${
    (performance.now() - dbStart).toFixed(2)
  }ms`
);

return res.status(200).json({
  success: true,
  chat,
});
  } catch (err) {
    console.error("[Chat Start Error]:", err);

    return res.status(500).json({
      message: "Failed to start chat",
    });
  }
});


router.get("/my-chats", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const chats = await Chat.find({
      participants: userId,
    })
      .select("participants status requestedBy")
      .populate({
        path: "participants",
        select: "username avatar",
      })
      .lean();

    // 🔥 Format response → return ONLY other user
    const formatted = chats
      .map((chat) => {
        const participants = Array.isArray(chat.participants)
          ? chat.participants.filter(Boolean)
          : [];

        // Find the participant who isn't the current user.
        const otherUser = participants.find(
          (participant) =>
            participant?._id &&
            participant._id.toString() !== userId.toString()
        );
        
        if (!otherUser) {
          console.warn("[CHAT] Skipping invalid chat:", {
            chatId: chat._id?.toString(),
            currentUserId: userId.toString(),
            participants: chat.participants,
            reason: "Other participant does not exist",
          });

          return null;
        }

        return {
          chatId: chat._id,
          status: chat.status,
          requestedBy: chat.requestedBy,
          user: {
            id: otherUser._id,
            name: otherUser.username,
            avatar: otherUser.avatar || "",
          },
        };
      })
      .filter(Boolean);

    res.json(formatted);

  } catch (err) {
    console.error("Fetch chats error:", err);
    res.status(500).json({ message: "Failed to fetch chats" });
  }
});

export default router;