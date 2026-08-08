import { getRedis } from '../config/redis.js';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export function aiRateLimit() {
  return async function aiRateLimitMiddleware(req, res, next) {
    const userId = req.auth?.userId;
    if (!userId) return next(new ApiError(401, 'UNAUTHENTICATED', 'Access token is required'));

    const key = `discovery:rate:ai:${userId}`;
    try {
      const redis = getRedis();
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, Math.ceil(config.rateLimit.aiWindowMs / 1000));
      }

      res.setHeader('X-RateLimit-Limit', String(config.rateLimit.aiMax));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, config.rateLimit.aiMax - current)));
      if (current > config.rateLimit.aiMax) {
        return next(new ApiError(429, 'AI_RATE_LIMITED', 'AI search limit reached. Please try again later.'));
      }
      return next();
    } catch (err) {
      if (err instanceof ApiError) return next(err);
      logger.error('ai_rate_limit_unavailable', { userId, message: err.message });
      return next(new ApiError(503, 'AI_UNAVAILABLE', 'AI search is temporarily unavailable'));
    }
  };
}
