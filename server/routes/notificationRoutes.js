import express from "express";
import Notification from "../models/Notifications.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * GET /api/notifications
 * Fetch latest notifications for logged-in user
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipientId: req.user.id,
    })
      .populate("actorsPreview", "username avatar")
      .populate("postId", "description assets")
      .sort({ createdAt: -1 })
      .limit(30);

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

router.get("/unread-count", authMiddleware, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipientId: req.user.id,
      isRead: false,
    });

    res.json({ unread: count });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch unread count" });
  }
});
router.patch("/:id/read", authMiddleware, async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipientId: req.user.id,
      },
      { isRead: true }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark as read" });
  }
});
router.patch("/read-all", authMiddleware, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipientId: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark all as read" });
  }
});

export default router;
