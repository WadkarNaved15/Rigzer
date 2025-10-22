import express from "express";
import FollowService from "../services/followService.js";
import  verifyToken  from "../middlewares/authMiddleware.js";

const router = express.Router();

// Follow a user
router.post("/:id/follow",verifyToken, async (req, res) => {
  try {
    const followerId = req.user.id; // req.user added via auth middleware
    const followingId = req.params.id;
    await FollowService.followUser(followerId, followingId);
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

// Get followers
router.get("/:id/followers", async (req, res) => {
  try {
    const followers = await FollowService.getFollowers(req.params.id);
    res.json({ count: followers.length, followers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get following
router.get("/:id/following", async (req, res) => {
  try {
    const following = await FollowService.getFollowing(req.params.id);
    res.json({ count: following.length, following });
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


export default router;
