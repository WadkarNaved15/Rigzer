import Follow from "../models/Follow.js";
import User from "../models/User.js";
import redis from "../config/redis.js";
import mongoose from "mongoose";

class FollowService {
  static async followUser(followerId, followingId) {
    if (!mongoose.Types.ObjectId.isValid(followerId) || !mongoose.Types.ObjectId.isValid(followingId))
      throw new Error("Invalid user ID");

    if (followerId === followingId) throw new Error("Cannot follow yourself");

    try {
      // ✅ Atomic via unique index
      const follow = await Follow.create({
        follower: followerId,
        following: followingId,
      });

      // ✅ Non-blocking counter updates
      User.updateOne({ _id: followerId }, { $inc: { followingCount: 1 } }).exec();
      User.updateOne({ _id: followingId }, { $inc: { followersCount: 1 } }).exec();

      // ✅ Cache updates async
      redis.sAdd(`user:${followerId}:following`, followingId);
      redis.sAdd(`user:${followingId}:followers`, followerId);
      redis.del(`followersCount:${followingId}`);
      redis.del(`followingCount:${followerId}`);
      redis.del(`suggested:${followerId}`);

      return follow;

    } catch (error) {
      if (error.code === 11000) {
        throw new Error("Already following");
      }
      throw error;
    }
  }
  static async unfollowUser(followerId, followingId) {
    const deleted = await Follow.findOneAndDelete({
      follower: followerId,
      following: followingId,
    });

    if (!deleted) throw new Error("Not following");

    // ✅ async counters
    User.updateOne({ _id: followerId }, { $inc: { followingCount: -1 } }).exec();
    User.updateOne({ _id: followingId }, { $inc: { followersCount: -1 } }).exec();

    // ✅ async cache
    redis.sRem(`user:${followerId}:following`, followingId);
    redis.sRem(`user:${followingId}:followers`, followerId);
    redis.del(`followersCount:${followingId}`);
    redis.del(`followingCount:${followerId}`);
    redis.del(`suggested:${followerId}`);

    return true;
  }

  // --- Read-only methods below do not need transactions ---

  static async getFollowers(userId, page = 1, limit = 20) {

    const skip = (page - 1) * limit;

    const docs = await Follow.find({ following: userId })
      .populate("follower", "username avatar")
      .select("follower -_id")
      .skip(skip)
      .limit(limit);

    const followers = docs
      .map(d => d.follower)
      .filter(Boolean);

    const total = await Follow.countDocuments({ following: userId });

    return {
      followers,
      total,
      page,
      hasMore: skip + followers.length < total
    };
  }

  static async getFollowing(userId, page = 1, limit = 20) {

    const skip = (page - 1) * limit;

    const docs = await Follow.find({ follower: userId })
      .populate("following", "username avatar")
      .select("following -_id")
      .skip(skip)
      .limit(limit);

    const following = docs
      .map(d => d.following)
      .filter(Boolean);

    const total = await Follow.countDocuments({ follower: userId });

    return {
      following,
      total,
      page,
      hasMore: skip + following.length < total
    };
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

    // ✅ get following set
    const following = await Follow.find({ follower: userId }).select("following");
    const followingSet = new Set(following.map(f => f.following.toString()));

    const suggested = await User.find({
      _id: { $nin: [...followingSet, userId] },
    })
      .select("_id username avatar name")
      .limit(5)
      .lean();

    // ✅ inject isFollowing
    const enriched = suggested.map(user => ({
      ...user,
      isFollowing: followingSet.has(user._id.toString()),
    }));

    await redis.set(cacheKey, JSON.stringify(enriched), "EX", 600);

    return enriched;
  }
}

export default FollowService;