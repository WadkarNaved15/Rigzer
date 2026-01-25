import redis from "../config/redis.js";

/**
 * Enhanced cache service with session-specific methods
 * Extends existing cache functionality
 */
class CacheService {
  constructor() {
    this.redis = redis;
    
    // TTL constants (in seconds)
    this.TTL = {
      GAME_POST: 3600, // 1 hour
      ACTIVE_SESSION: 7200, // 2 hours
      USER_SESSIONS: 300, // 5 minutes
      RATE_LIMIT: 60, // 1 minute
      INSTANCE_LOAD: 30, // 30 seconds
    };
  }

  // ============================================
  // Generic Cache Methods (Existing)
  // ============================================

  async get(key) {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key, data, ttl = 300) {
    await this.redis.set(key, JSON.stringify(data), "EX", ttl);
  }

  async del(...keys) {
    if (keys.length) await this.redis.del(keys);
  }

  async sAdd(key, ...values) {
    if (values.length) await this.redis.sAdd(key, ...values);
  }

  async sRem(key, ...values) {
    if (values.length) await this.redis.sRem(key, ...values);
  }

  async sMembers(key) {
    return await this.redis.sMembers(key);
  }

  async incr(key, amount = 1) {
    await this.redis.incrby(key, amount);
  }

  async clearUserCache(userId) {
    const keys = [
      `followers:${userId}`,
      `following:${userId}`,
      `followersCount:${userId}`,
      `followingCount:${userId}`,
    ];
    await this.redis.del(keys);
  }

  // ============================================
  // Session-Specific Cache Methods (New)
  // ============================================

  /**
   * Game Post Caching
   */
  async getGamePost(gamePostId) {
    try {
      const key = `game:${gamePostId}`;
      return await this.get(key);
    } catch (err) {
      console.error("Cache get error:", err);
      return null;
    }
  }

  async setGamePost(gamePostId, data) {
    try {
      const key = `game:${gamePostId}`;
      await this.set(key, data, this.TTL.GAME_POST);
    } catch (err) {
      console.error("Cache set error:", err);
    }
  }

  /**
   * Active Session Caching
   */
  async getActiveSession(sessionId) {
    try {
      const key = `session:${sessionId}`;
      return await this.get(key);
    } catch (err) {
      console.error("Cache get error:", err);
      return null;
    }
  }

  async setActiveSession(sessionId, data) {
    try {
      const key = `session:${sessionId}`;
      await this.set(key, data, this.TTL.ACTIVE_SESSION);

      // Add to user's active sessions set
      if (data.userId) {
        const userKey = `user:${data.userId}:sessions`;
        await this.sAdd(userKey, sessionId);
        await this.redis.expire(userKey, this.TTL.USER_SESSIONS);
      }
    } catch (err) {
      console.error("Cache set error:", err);
    }
  }

  async deleteActiveSession(sessionId) {
    try {
      const key = `session:${sessionId}`;
      
      // Get session data to find userId
      const session = await this.getActiveSession(sessionId);
      
      await this.del(key);

      // Remove from user's active sessions
      if (session?.userId) {
        const userKey = `user:${session.userId}:sessions`;
        await this.sRem(userKey, sessionId);
      }
    } catch (err) {
      console.error("Cache delete error:", err);
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserActiveSessions(userId) {
    try {
      const userKey = `user:${userId}:sessions`;
      return await this.sMembers(userKey);
    } catch (err) {
      console.error("Cache get error:", err);
      return [];
    }
  }

  /**
   * Clear all session cache for a user
   */
  async clearUserSessionCache(userId) {
    try {
      const sessionIds = await this.getUserActiveSessions(userId);
      
      // Delete individual session keys
      const sessionKeys = sessionIds.map(id => `session:${id}`);
      if (sessionKeys.length) {
        await this.del(...sessionKeys);
      }

      // Delete user sessions set
      await this.del(`user:${userId}:sessions`);
    } catch (err) {
      console.error("Cache clear error:", err);
    }
  }

  // ============================================
  // Rate Limiting Methods
  // ============================================

  /**
   * Increment rate limit counter
   */
  async incrementRateLimit(key, windowSeconds = 60) {
    try {
      const current = await this.redis.incr(key);
      
      if (current === 1) {
        await this.redis.expire(key, windowSeconds);
      }
      
      return current;
    } catch (err) {
      console.error("Rate limit error:", err);
      return 0;
    }
  }

  /**
   * Check if rate limit exceeded
   */
  async checkRateLimit(key, limit, windowSeconds = 60) {
    try {
      const current = await this.redis.get(key);
      return parseInt(current || 0) >= limit;
    } catch (err) {
      console.error("Rate limit check error:", err);
      return false;
    }
  }

  /**
   * Get remaining rate limit
   */
  async getRateLimitRemaining(key, limit) {
    try {
      const current = await this.redis.get(key);
      return Math.max(0, limit - parseInt(current || 0));
    } catch (err) {
      console.error("Rate limit check error:", err);
      return limit;
    }
  }

  /**
   * Get TTL for rate limit key
   */
  async getRateLimitTTL(key) {
    try {
      return await this.redis.ttl(key);
    } catch (err) {
      console.error("TTL check error:", err);
      return -1;
    }
  }

  // ============================================
  // Instance Load Tracking
  // ============================================

  /**
   * Track instance load in cache
   */
  async getInstanceLoad(instanceId) {
    try {
      const load = await this.redis.hGet("instance:load", instanceId);
      return parseInt(load || 0);
    } catch (err) {
      console.error("Instance load get error:", err);
      return 0;
    }
  }

  async incrementInstanceLoad(instanceId) {
    try {
      await this.redis.hIncrBy("instance:load", instanceId, 1);
      await this.redis.expire("instance:load", this.TTL.INSTANCE_LOAD);
    } catch (err) {
      console.error("Instance load increment error:", err);
    }
  }

  async decrementInstanceLoad(instanceId) {
    try {
      const current = await this.getInstanceLoad(instanceId);
      if (current > 0) {
        await this.redis.hIncrBy("instance:load", instanceId, -1);
      }
    } catch (err) {
      console.error("Instance load decrement error:", err);
    }
  }

  async getAllInstanceLoads() {
    try {
      const loads = await this.redis.hGetAll("instance:load");
      return Object.entries(loads || {}).reduce((acc, [id, load]) => {
        acc[id] = parseInt(load);
        return acc;
      }, {});
    } catch (err) {
      console.error("Instance loads get error:", err);
      return {};
    }
  }

  // ============================================
  // Session Metrics Caching
  // ============================================

  /**
   * Cache session metrics temporarily
   */
  async cacheSessionMetrics(sessionId, metrics) {
    try {
      const key = `metrics:${sessionId}`;
      await this.set(key, metrics, 3600); // 1 hour
    } catch (err) {
      console.error("Metrics cache error:", err);
    }
  }

  async getSessionMetrics(sessionId) {
    try {
      const key = `metrics:${sessionId}`;
      return await this.get(key);
    } catch (err) {
      console.error("Metrics get error:", err);
      return null;
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Check if key exists
   */
  async exists(key) {
    try {
      return await this.redis.exists(key) === 1;
    } catch (err) {
      console.error("Exists check error:", err);
      return false;
    }
  }

  /**
   * Set with custom expiry
   */
  async setEx(key, data, seconds) {
    try {
      await this.redis.setex(key, seconds, JSON.stringify(data));
    } catch (err) {
      console.error("SetEx error:", err);
    }
  }

  /**
   * Multi-key get (pipeline)
   */
  async mGet(keys) {
    try {
      const values = await this.redis.mget(keys);
      return values.map(v => v ? JSON.parse(v) : null);
    } catch (err) {
      console.error("Multi-get error:", err);
      return keys.map(() => null);
    }
  }

  /**
   * Pattern-based key deletion
   */
  async deletePattern(pattern) {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length) {
        await this.redis.del(keys);
      }
      return keys.length;
    } catch (err) {
      console.error("Pattern delete error:", err);
      return 0;
    }
  }

  /**
   * Clear all session-related cache
   */
  async clearAllSessionCache() {
    try {
      await this.deletePattern("session:*");
      await this.deletePattern("game:*");
      await this.deletePattern("user:*:sessions");
      await this.del("instance:load");
    } catch (err) {
      console.error("Clear all cache error:", err);
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this.redis.ping();
      return true;
    } catch (err) {
      console.error("Redis health check failed:", err);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      const info = await this.redis.info("stats");
      return info;
    } catch (err) {
      console.error("Stats error:", err);
      return null;
    }
  }
}

export default new CacheService();