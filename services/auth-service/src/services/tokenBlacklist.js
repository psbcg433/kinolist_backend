import { getRedis } from '../config/redis.js';
import { logger } from '../utils/logger.js';

// Shared Redis revocation state. Namespaces:
//   auth:blacklist:{jti}      -> revoked access token
//   auth:sid-revoked:{sid}    -> revoked session
//   auth:tv:{userId}          -> current account token version
// These keys carry TTLs so they never become durable state.

function parseAccessTtlSeconds(ttl) {
  const match = /^(\d+)([smhd]?)$/.exec(String(ttl || '15m'));
  if (!match) return 900;
  const amount = Number(match[1]);
  switch (match[2] || 's') {
    case 's': return amount;
    case 'm': return amount * 60;
    case 'h': return amount * 3600;
    case 'd': return amount * 86400;
    default: return amount;
  }
}

export const tokenBlacklist = {
  accessTtlSeconds: parseAccessTtlSeconds(process.env.JWT_ACCESS_TTL || '15m'),

  async revokeJti(jti, { durable = false } = {}) {
    try {
      const redis = getRedis();
      await redis.set(`auth:blacklist:${jti}`, '1', 'EX', this.accessTtlSeconds);
    } catch (err) {
      logger.error('blacklist_jti_failed', { message: err.message });
      if (!durable) throw err;
    }
  },

  async isJtiRevoked(jti) {
    try {
      const redis = getRedis();
      return (await redis.exists(`auth:blacklist:${jti}`)) === 1;
    } catch {
      logger.warn('blacklist_check_redis_failure');
      return false;
    }
  },

  async revokeSession(sid) {
    try {
      const redis = getRedis();
      await redis.set(`auth:sid-revoked:${sid}`, '1', 'EX', this.accessTtlSeconds);
    } catch (err) {
      logger.error('blacklist_sid_failed', { message: err.message });
      throw err;
    }
  },

  async isSessionRevoked(sid) {
    try {
      const redis = getRedis();
      return (await redis.exists(`auth:sid-revoked:${sid}`)) === 1;
    } catch {
      logger.warn('blacklist_sid_check_redis_failure');
      return false;
    }
  },

  async setTokenVersion(userId, version) {
    try {
      const redis = getRedis();
      await redis.set(`auth:tv:${userId}`, String(version), 'EX', this.accessTtlSeconds);
    } catch (err) {
      logger.error('tv_set_failed', { message: err.message });
      throw err;
    }
  },

  async getTokenVersion(userId) {
    try {
      const redis = getRedis();
      const value = await redis.get(`auth:tv:${userId}`);
      return value ? Number(value) : null;
    } catch {
      return null;
    }
  },
};
