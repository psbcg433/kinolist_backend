import { getRedis } from '../config/redis.js';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

function clientKey(req) {
  const ip = req.clientIp || req.ip || req.socket.remoteAddress || 'unknown';
  return `gateway:rate:${ip}`;
}

export function rateLimit({ windowMs = config.rateLimitWindowMs, max = config.rateLimitMax } = {}) {
  return async function rateLimitMiddleware(req, res, next) {
    const key = clientKey(req);
    let redis;
    try {
      redis = getRedis();
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, Math.ceil(windowMs / 1000));
      }
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - current)));
      if (current > max) {
        return next(new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please slow down.'));
      }
      return next();
    } catch (err) {
      logger.warn('rate_limit_redis_failure', { message: err.message });
      // The gateway also protects anonymous provider-backed routes. Letting
      // requests through without a shared counter would turn a Redis outage
      // into an unlimited external-API abuse window.
      return next(new ApiError(503, 'RATE_LIMIT_UNAVAILABLE', 'The API is temporarily unavailable'));
    }
  };
}
