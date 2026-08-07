import { getRedis } from '../config/redis.js';
import { logger } from '../utils/logger.js';

/** Redis-backed cache that fails open (returns null / no-ops) on outages. */
export async function getCache(key) {
  try {
    const raw = await getRedis().get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    logger.warn('discovery_cache_read_failed', { key, message: err.message });
    return null;
  }
}

export async function setCache(key, data, ttlSeconds) {
  try {
    await getRedis().set(key, JSON.stringify(data), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn('discovery_cache_write_failed', { key, message: err.message });
  }
}

/** Read-through with fail-open: returns cached value on upstream errors. */
export async function cached(key, ttlSeconds, compute) {
  const cachedValue = await getCache(key);
  if (cachedValue !== null) return cachedValue;
  try {
    const value = await compute();
    await setCache(key, value, ttlSeconds);
    return value;
  } catch (err) {
    const stale = await getCache(key);
    if (stale !== null) return stale;
    throw err;
  }
}
