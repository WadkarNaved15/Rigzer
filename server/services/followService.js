import Follow from "../models/Follow.js";
import User from "../models/User.js";
import redis from "../config/redis.js";
import mongoose from "mongoose";

class FollowService {
  static async followUser(followerId, followingId) {
    if (!mongoose.Types.ObjectId.isValid(followerId) || !mongoose.Types.ObjectId.isValid(followingId))
      throw new Error("Invalid user ID");

    if (followerId === followingId) throw new Error("Cannot follow yourself");

    const session = await mongoose.startSession();
    session.startTransaction();

    let follow;
    try {
      const opts = { session };
      // We just try to create it.
      const followDocs = await Follow.create([{ follower: followerId, following: followingId }], opts);
      follow = followDocs[0];

      await Promise.all([
        User.findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } }, opts),
        User.findByIdAndUpdate(followingId, { $inc: { followersCount: 1 } }, opts),
      ]);

      await session.commitTransaction();

    } catch (error) {
      await session.abortTransaction();

      if (error.code === 11000) {
        throw new Error("Already following");
      }

      // Throw any other errors
      throw error;
    } finally {
      session.endSession();
    }

    // --- Cache Invalidation (remains the same) ---
    try {
      await Promise.all([
        redis.sAdd(`user:${followerId}:following`, followingId),
        redis.sAdd(`user:${followingId}:followers`, followerId),
        redis.del(`followersCount:${followingId}`),
        redis.del(`followingCount:${followerId}`),
        redis.del(`suggested:${followerId}`)
      ]);
    } catch (cacheError) {
      console.error("Cache invalidation failed after follow:", cacheError);
    }

    return follow;
  }

  static async unfollowUser(followerId, followingId) {
    if (!mongoose.Types.ObjectId.isValid(followerId) || !mongoose.Types.ObjectId.isValid(followingId))
      throw new Error("Invalid user ID");

    // Start a session for the transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const opts = { session };

      const unfollow = await Follow.findOneAndDelete({ follower: followerId, following: followingId }, opts);
      if (!unfollow) throw new Error("Not following");

      // Perform all database updates within the transaction
      await Promise.all([
        User.findByIdAndUpdate(followerId, { $inc: { followingCount: -1 } }, opts),
        User.findByIdAndUpdate(followingId, { $inc: { followersCount: -1 } }, opts),
      ]);

      // If all DB operations succeed, commit the transaction
      await session.commitTransaction();

    } catch (error) {
      // If any operation fails, abort the entire transaction
      await session.abortTransaction();
      throw error; // Rethrow the error
    } finally {
      // Always end the session
      session.endSession();
    }

    // --- Cache Invalidation (Runs *after* successful transaction) ---
    try {
      await Promise.all([
        redis.sRem(`user:${followerId}:following`, followingId),
        redis.sRem(`user:${followingId}:followers`, followerId),
        redis.del(`followersCount:${followingId}`),
        redis.del(`followingCount:${followerId}`),
        // CRITICAL: Invalidate suggested users cache for the follower
        redis.del(`suggested:${followerId}`)
      ]);
    } catch (cacheError) {
      console.error("Cache invalidation failed after unfollow:", cacheError);
    }

    return true;
  }

  // --- Read-only methods below do not need transactions ---

  static async getFollowers(userId) {
    const docs = await Follow.find({ following: userId })
      .populate("follower", "username avatar")
      .select("follower -_id");

    return docs
      .map(d => d.follower)
      .filter(Boolean);
  }

  static async getFollowing(userId) {
    const docs = await Follow.find({ follower: userId })
      .populate("following", "username avatar")
      .select("following -_id");

    return docs
      .map(d => d.following)
      .filter(Boolean);
  }

  static async getFollowersCount(userId) {
    const cacheKey = `followersCount:${userId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return parseInt(cached, 10);

    const count = await Follow.countDocuments({ following: userId });
    await redis.set(cacheKey, count, { EX: 300 }); // cache 5 min
    return count;
  }

  static async getFollowingCount(userId) {
    const cacheKey = `followingCount:${userId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return parseInt(cached, 10);

    const count = await Follow.countDocuments({ follower: userId });
    await redis.set(cacheKey, count, { EX: 300 });
    return count;
  }

  static async getSuggestedUsers(userId) {
    const cacheKey = `suggested:${userId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Get IDs of users the current user is already following
    const following = await Follow.find({ follower: userId }).select("following");
    const followingIds = following.map(f => f.following.toString());

    // Exclude current user and already following users
    const suggested = await User.find({
      _id: { $nin: [...followingIds, userId] },
    }).limit(5);

    // Cache for 10 minutes
    await redis.set(cacheKey, JSON.stringify(suggested), "EX", 600);

    return suggested;
  }
}

export default FollowService;