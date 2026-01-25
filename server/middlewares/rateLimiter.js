import cacheService from "../services/cacheService.js";

/**
 * Rate limiting configurations
 */
const RATE_LIMITS = {
  sessionStart: {
    points: 10, // Max 10 requests
    duration: 60, // Per 60 seconds
    blockDuration: 300, // Block for 5 minutes
  },
  sessionStatus: {
    points: 60,
    duration: 60,
  },
  general: {
    points: 100,
    duration: 60,
  },
};

/**
 * Rate limiter middleware factory
 */
export function createRateLimiter(limitType = "general") {
  return async (req, res, next) => {
    try {
      const config = RATE_LIMITS[limitType] || RATE_LIMITS.general;
      const identifier = req.user?.id || req.ip;
      const key = `ratelimit:${limitType}:${identifier}`;

      // Check if blocked
      const blockKey = `${key}:blocked`;
      const isBlocked = await cacheService.exists(blockKey);
      
      if (isBlocked) {
        const ttl = await cacheService.getRateLimitTTL(blockKey);
        return res.status(429).json({
          error: "Too many requests",
          message: "Rate limit exceeded. Please try again later.",
          retryAfter: ttl > 0 ? ttl : config.blockDuration,
        });
      }

      // Increment counter
      const current = await cacheService.incrementRateLimit(key, config.duration);

      // Set rate limit headers
      res.setHeader("X-RateLimit-Limit", config.points);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, config.points - current));
      
      const ttl = await cacheService.getRateLimitTTL(key);
      res.setHeader("X-RateLimit-Reset", Date.now() + ttl * 1000);

      // Check if limit exceeded
      if (current > config.points) {
        // Block user for configured duration
        if (config.blockDuration) {
          await cacheService.setEx(blockKey, { blocked: true }, config.blockDuration);
        }

        return res.status(429).json({
          error: "Too many requests",
          message: "Rate limit exceeded. Please try again later.",
          retryAfter: config.blockDuration || config.duration,
        });
      }

      next();
    } catch (err) {
      console.error("Rate limiter error:", err);
      // On error, allow request to proceed (fail open)
      next();
    }
  };
}

/**
 * IP-based rate limiter for unauthenticated requests
 */
export function ipRateLimiter(points = 20, duration = 60) {
  return async (req, res, next) => {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const key = `ratelimit:ip:${ip}`;

      const current = await cacheService.incrementRateLimit(key, duration);

      if (current > points) {
        return res.status(429).json({
          error: "Too many requests",
          message: "Please slow down and try again later.",
          retryAfter: duration,
        });
      }

      next();
    } catch (err) {
      console.error("IP rate limiter error:", err);
      next();
    }
  };
}

/**
 * Adaptive rate limiter that adjusts based on system load
 */
export class AdaptiveRateLimiter {
  constructor() {
    this.basePoints = 10;
    this.currentPoints = 10;
    this.loadThreshold = 0.8; // 80% system load
  }

  async middleware(req, res, next) {
    try {
      // Adjust rate limits based on system load
      const systemLoad = await this.getSystemLoad();
      
      if (systemLoad > this.loadThreshold) {
        this.currentPoints = Math.max(5, Math.floor(this.basePoints * 0.5));
      } else {
        this.currentPoints = this.basePoints;
      }

      const identifier = req.user?.id || req.ip;
      const key = `ratelimit:adaptive:${identifier}`;

      const current = await cacheService.incrementRateLimit(key, 60);

      res.setHeader("X-RateLimit-Limit", this.currentPoints);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, this.currentPoints - current));

      if (current > this.currentPoints) {
        return res.status(429).json({
          error: "Too many requests",
          message: "System is under high load. Please try again later.",
          retryAfter: 60,
        });
      }

      next();
    } catch (err) {
      console.error("Adaptive rate limiter error:", err);
      next();
    }
  }

  async getSystemLoad() {
    // Implement based on your monitoring system
    // For now, return a mock value
    return 0.5;
  }
}

export default createRateLimiter;