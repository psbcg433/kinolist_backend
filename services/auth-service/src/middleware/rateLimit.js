import { getRedis } from '../config/redis.js';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

function clientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return forwarded ? String(forwarded).split(',')[0].trim() : req.socket.remoteAddress || 'unknown';
}

export function rateLimit({ namespace, max }) {
  return async function rateLimitMiddleware(req, _res, next) {
    const ip = clientKey(req);
    const key = `auth:rate:${namespace}:${ip}`;
    let redis;
    try {
      redis = getRedis();
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, Math.ceil(config.rateLimit.windowMs / 1000));
      }
      if (current > max) {
        return next(new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.'));
      }
      return next();
    } catch (err) {
      logger.warn('rate_limit_redis_failure', { namespace, message: err.message });
      return next();
    }
  };
}
