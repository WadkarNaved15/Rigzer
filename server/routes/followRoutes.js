import express from "express";
import FollowService from "../services/followService.js";
import  verifyToken  from "../middlewares/authMiddleware.js";
import { sendEventToQueue } from "../utils/sendEventToQueue.js";
const router = express.Router();

// Follow a user
router.post("/:id/follow",verifyToken, async (req, res) => {
  try {
    const followerId = req.user.id; // req.user added via auth middleware
    const followingId = req.params.id;
    await FollowService.followUser(followerId, followingId);
    // ✅ Push Follow Event to SQS
    if (followerId !== followingId) {
      await sendEventToQueue({
        type: "FOLLOW",
        actorId: followerId,
        recipientId: followingId,
        createdAt: new Date(),
      });
    }
    res.json({ success: true, message: "Followed successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Unfollow a user
router.post("/:id/unfollow",verifyToken, async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.id;
    await FollowService.unfollowUser(followerId, followingId);
    res.json({ success: true, message: "Unfollowed successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// Get followers and following
router.get("/:id/followers", async (req, res) => {
  try {
    const userId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await FollowService.getFollowers(userId, page, limit);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/following", async (req, res) => {
  try {
    const userId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await FollowService.getFollowing(userId, page, limit);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get suggested users to follow
router.get("/:id/suggested", async (req, res) => {
  try {
    const userId = req.params.id; // current logged-in user
    const suggested = await FollowService.getSuggestedUsers(userId);
    res.json({ users: suggested });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/:id/followers/count", async (req, res) => {
  const count = await FollowService.getFollowersCount(req.params.id);
  res.json({ count });
});

router.get("/:id/following/count", async (req, res) => {
  const count = await FollowService.getFollowingCount(req.params.id);
  res.json({ count });
});

export default router;
