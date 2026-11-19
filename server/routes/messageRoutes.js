
import express from "express";
import mongoose from "mongoose";

import Message from "../models/Message.js";
import Chat from "../models/Chat.js";
import verifyToken from "../middlewares/authMiddleware.js";

const router = express.Router();

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

// --------------------------------------------------
// Helpers
// --------------------------------------------------

async function getUserChat(chatId, userId) {
  if (!mongoose.isValidObjectId(chatId)) {
    return null;
  }

  return Chat.findOne({
    _id: chatId,
    participants: userId,
  })
    .select("_id status")
    .lean();
}

function validateEncryptedPayload(payload, encryption) {
  if (!payload || !encryption) return false;

  if (encryption.protocol !== "signal") return false;
  if (encryption.version !== 1) return false;

  if (
    typeof payload.ciphertext !== "string" ||
    !payload.ciphertext.length
  ) {
    return false;
  }

  if (
    !["SignalMessage", "PreKeySignalMessage"].includes(
      payload.signalType
    )
  ) {
    return false;
  }

  if (
    typeof payload.deviceId !== "string" ||
    !payload.deviceId.trim()
  ) {
    return false;
  }

  return true;
}

// --------------------------------------------------
// Send encrypted message
// POST /api/messages
// --------------------------------------------------

router.post("/", verifyToken, async (req, res) => {
  try {
    const senderId = req.user.id;

    const {
      chatId,
      encryptedPayload,
      encryption,
      messageType = "text",
      mediaUrl = null,
      mediaType = null,
      replyTo = null,
    } = req.body;

    if (!mongoose.isValidObjectId(chatId)) {
      return res.status(400).json({
        message: "Invalid chat ID",
      });
    }

    // Reject plaintext messages.
    if (req.body.text || req.body.mediaKey || req.body.sharedPostId) {
      return res.status(400).json({
        message: "Plaintext messages are not supported",
      });
    }

    if (!validateEncryptedPayload(encryptedPayload, encryption)) {
      return res.status(400).json({
        message: "Invalid encrypted message payload",
      });
    }

    if (!["text", "media", "post"].includes(messageType)) {
      return res.status(400).json({
        message: "Invalid message type",
      });
    }

    if (
      mediaType !== null &&
      !["image", "video"].includes(mediaType)
    ) {
      return res.status(400).json({
        message: "Invalid media type",
      });
    }

    if (messageType === "media" && !mediaUrl) {
      return res.status(400).json({
        message: "Media URL is required",
      });
    }

    if (messageType !== "media" && mediaUrl) {
      return res.status(400).json({
        message: "Media URL is only allowed for media messages",
      });
    }

    const chat = await getUserChat(chatId, senderId);

    if (!chat) {
      return res.status(403).json({
        message: "Chat not found or access denied",
      });
    }

    if (chat.status === "declined") {
      return res.status(403).json({
        message: "This chat has been declined",
      });
    }
    const participants = await Chat.findById(chatId)
      .select("participants")
      .lean();

    if (!participants || participants.participants.length !== 2) {
      return res.status(400).json({
        message: "This endpoint currently supports one-to-one chats only",
      });
    }

    // Never trust receiverId supplied by the frontend.
    const receiverId = participants.participants.find(
      (id) => id.toString() !== senderId.toString()
    );

    if (!receiverId) {
      return res.status(400).json({
        message: "Unable to resolve chat recipient",
      });
    }

    // Validate reply target and store IDs only.
    let resolvedReplyTo = null;

    if (replyTo?.messageId) {
      if (!mongoose.isValidObjectId(replyTo.messageId)) {
        return res.status(400).json({
          message: "Invalid reply message ID",
        });
      }

      const repliedMessage = await Message.findOne({
        _id: replyTo.messageId,
        chatId,
      })
        .select("_id senderId")
        .lean();

      if (!repliedMessage) {
        return res.status(400).json({
          message: "Reply message not found",
        });
      }

      resolvedReplyTo = {
        messageId: repliedMessage._id,
        senderId: repliedMessage.senderId,
      };
    }

    const message = await Message.create({
      chatId,
      senderId,
      receiverId,

      encryptedPayload,
      encryption,

      messageType,
      mediaUrl,
      mediaType,

      replyTo: resolvedReplyTo,

      seen: false,
    });

    // Clear any old cache entry, including legacy plaintext data.
    // Socket.IO will also need to invalidate this cache.
    try {
      await import("../config/redis.js").then(({ default: redis }) =>
        redis.del(`chat:messages:${chatId}`)
      );
    } catch (cacheError) {
      console.error("Message cache invalidation failed:", cacheError);
    }

    return res.status(201).json({
      success: true,
      message,
    });
  } catch (err) {
    console.error("Send encrypted message error:", err);

    return res.status(500).json({
      message: "Failed to send encrypted message",
    });
  }
});

// --------------------------------------------------
// Get unread message counts
// GET /api/messages/unread-counts
// --------------------------------------------------

router.get("/unread-counts", verifyToken, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const unread = await Message.aggregate([
      {
        $match: {
          receiverId: userId,
          seen: false,
        },
      },
      {
        $group: {
          _id: {
            chatId: "$chatId",
            senderId: "$senderId",
          },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "chats",
          localField: "_id.chatId",
          foreignField: "_id",
          as: "chat",
        },
      },
      {
        $unwind: "$chat",
      },
      {
        $match: {
          "chat.status": { $ne: "declined" },
          "chat.participants": userId,
        },
      },
      {
        $group: {
          _id: "$_id.senderId",
          count: { $sum: "$count" },
        },
      },
    ]);

    return res.json(unread);
  } catch (err) {
    console.error("Unread count error:", err);

    return res.status(500).json({
      message: "Failed to fetch unread counts",
    });
  }
});

// --------------------------------------------------
// Mark messages as seen
// PUT /api/messages/seen/:chatId
// --------------------------------------------------

router.put("/seen/:chatId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;

    const chat = await getUserChat(chatId, userId);

    if (!chat) {
      return res.status(403).json({
        message: "Chat not found or access denied",
      });
    }

    const result = await Message.updateMany(
      {
        chatId,
        receiverId: userId,
        seen: false,
      },
      {
        $set: {
          seen: true,
          seenAt: new Date(),
        },
      }
    );

    return res.json({
      success: true,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("Mark messages seen error:", err);

    return res.status(500).json({
      message: "Failed to mark messages as seen",
    });
  }
});

// --------------------------------------------------
// Get messages for a chat
// GET /api/messages/:chatId
// --------------------------------------------------

router.get("/:chatId", verifyToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await getUserChat(chatId, userId);

    if (!chat) {
      return res.status(403).json({
        message: "Chat not found or access denied",
      });
    }

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );

    const before = req.query.before;

    const query = { chatId };

    if (before) {
      let cursor;

      try {
        cursor = JSON.parse(
          Buffer.from(before, "base64").toString("utf8")
        );
      } catch {
        return res.status(400).json({
          message: "Invalid cursor",
        });
      }

      if (
        !cursor.createdAt ||
        !mongoose.isValidObjectId(cursor._id) ||
        Number.isNaN(new Date(cursor.createdAt).getTime())
      ) {
        return res.status(400).json({
          message: "Invalid cursor",
        });
      }

      const cursorDate = new Date(cursor.createdAt);

      query.$or = [
        {
          createdAt: { $lt: cursorDate },
        },
        {
          createdAt: cursorDate,
          _id: { $lt: cursor._id },
        },
      ];
    }

    const fetchedMessages = await Message.find(query)
      .select(
        [
          "senderId",
          "receiverId",
          "e2eeMessageId",
          "mediaUrl",
          "mediaType",
          "messageType",
          "replyTo",
          "seen",
          "seenAt",
          "createdAt",
        ].join(" ")
      )
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .limit(limit + 1)
      .lean();

    const hasMore = fetchedMessages.length > limit;

    const messages = fetchedMessages.slice(0, limit).reverse();

    const oldest = messages[0];

    const nextCursor = hasMore && oldest
      ? Buffer.from(
          JSON.stringify({
            createdAt: oldest.createdAt,
            _id: oldest._id,
          })
        ).toString("base64")
      : null;

    return res.json({
      messages,
      hasMore,
      nextCursor,
    });
  } catch (err) {
    console.error("Fetch messages error:", err);

    return res.status(500).json({
      message: "Failed to fetch messages",
    });
  }
});


router.post("/e2ee/metadata", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id; // Use the same authenticated user field as your other routes.

    const {
      chatId,
      e2eeMessageId,
      senderId,
      receiverId,
      messageType = "text",
      replyTo = null,
      timestamp,
    } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(chatId) ||
      !e2eeMessageId ||
      typeof e2eeMessageId !== "string"
    ) {
      return res.status(400).json({ message: "Invalid message metadata" });
    }

    if (
      !mongoose.Types.ObjectId.isValid(senderId) ||
      !mongoose.Types.ObjectId.isValid(receiverId)
    ) {
      return res.status(400).json({ message: "Invalid participants" });
    }

    if (!["text", "media", "post"].includes(messageType)) {
      return res.status(400).json({ message: "Invalid message type" });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const participants = chat.participants.map(String);

    if (
      !participants.includes(String(userId)) ||
      !participants.includes(String(senderId)) ||
      !participants.includes(String(receiverId))
    ) {
      return res.status(403).json({ message: "Not authorized for this chat" });
    }

    // Sender or recipient may report the same message.
    // Do not allow a caller to change the original sender/receiver.
    if (
      String(userId) !== String(senderId) &&
      String(userId) !== String(receiverId)
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const createdAt = timestamp ? new Date(timestamp) : new Date();

    if (Number.isNaN(createdAt.getTime())) {
      return res.status(400).json({ message: "Invalid timestamp" });
    }

    const message = await Message.findOneAndUpdate(
      { e2eeMessageId },
      {
        $setOnInsert: {
          chatId,
          senderId,
          receiverId,
          e2eeMessageId,
          messageType,
          text: "",
          encryptedPayload: null,
          encryption: null,
          replyTo: replyTo?.messageId
            ? {
                messageId: replyTo.messageId,
                senderId: replyTo.senderId ?? null,
              }
            : null,
          createdAt,
          seen: false,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    // Invalidate your existing chat-history cache here, if applicable.

    return res.status(200).json({
      message: "Metadata saved",
      data: message,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(200).json({ message: "Already saved" });
    }

    console.error("[E2EE] Metadata save error:", error);
    return res.status(500).json({ message: "Failed to save message metadata" });
  }
});

export default router;
