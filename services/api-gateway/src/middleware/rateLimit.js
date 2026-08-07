import { getRedis } from '../config/redis.js';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

function clientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? String(forwarded).split(',')[0].trim() : req.socket.remoteAddress || 'unknown';
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
      // Fail-open on Redis outage for the gateway-level limiter; services still
      // enforce their own protection. Documented in docs/architecture.md.
      logger.warn('rate_limit_redis_failure', { message: err.message });
      return next();
    }
  };
}
