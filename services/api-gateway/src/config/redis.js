import Redis from 'ioredis';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

let redis = null;

export function getRedis() {
  if (!redis) {
    redis = new Redis(config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => {
        if (times > 10) return null;
        return Math.min(times * 250, 3000);
      },
    });
    redis.on('error', (err) => {
      logger.error('redis_error', { message: err.message });
    });
  }
  return redis;
}

export async function connectRedis() {
  const client = getRedis();
  await client.connect();
  return client;
}

export async function disconnectRedis() {
  if (redis) {
    await redis.quit().catch(() => {});
    redis = null;
  }
}

export async function redisPing() {
  const client = getRedis();
  const result = await client.ping();
  return result === 'PONG';
}
