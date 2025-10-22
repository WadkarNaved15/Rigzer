import redis from "../config/redis.js";

class CacheService {
  async get(key) {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key, data, ttl = 300) {
    await redis.set(key, JSON.stringify(data), "EX", ttl);
  }

  async del(...keys) {
    if (keys.length) await redis.del(keys);
  }

  async sAdd(key, ...values) {
    if (values.length) await redis.sadd(key, ...values);
  }

  async sRem(key, ...values) {
    if (values.length) await redis.srem(key, ...values);
  }

  async sMembers(key) {
    return await redis.smembers(key);
  }

  async incr(key, amount = 1) {
    await redis.incrby(key, amount);
  }

  async clearUserCache(userId) {
    const keys = [
      `followers:${userId}`,
      `following:${userId}`,
      `followersCount:${userId}`,
      `followingCount:${userId}`,
    ];
    await redis.del(keys);
  }
}

export default new CacheService();
