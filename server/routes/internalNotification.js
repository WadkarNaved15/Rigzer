import express from "express";
import Notification from "../models/Notifications.js";

const router = express.Router();

export default function internalNotificationRoutes(io, onlineUsers) {
  router.post("/notify-realtime", async (req, res) => {
    console.log("notify-realtime got hit");

    const secret = req.headers["x-internal-secret"];
    if (secret !== process.env.INTERNAL_SECRET) {
      return res.status(403).json({ error: "Forbidden" });
    }

    try {
      const { recipientId, notificationId } = req.body;

      // ✅ Fetch full populated notification
      const fullNotification = await Notification.findById(notificationId)
        .populate("actorsPreview", "username avatar")
        .populate("postId", "description assets");

      if (!fullNotification) {
        return res.status(404).json({ error: "Notification not found" });
      }

      // Check online sockets
      const sockets = onlineUsers.get(recipientId);

      if (sockets) {
        sockets.forEach((socketId) => {
          io.to(socketId).emit("new-notification", fullNotification);
          console.log("🔥 Notification emitted:", socketId);
        });
      }

      return res.json({ success: true });
    } catch (err) {
      console.error("Socket Notify Error:", err);
      res.status(500).json({ success: false });
    }
  });

  return router;
}
