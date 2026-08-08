import { getRedis } from '../../config/redis.js';
import { config } from '../../config/env.js';
import { profileService } from '../../services/profileService.js';
import { logger } from '../../utils/logger.js';

const STREAM = config.redis.stream;
const GROUP = 'profile-consumer';
const CONSUMER = `profile-worker-${process.pid}`;
const DLQ = config.redis.dlq;

const BATCH_SIZE = 10;
const CLAIM_ATTEMPTS = 3;

export function parseStreamEntry(fields) {
  const parsed = {};
  for (let i = 0; i < fields.length; i += 2) parsed[fields[i]] = fields[i + 1];

  if (parsed.event) {
    const envelope = JSON.parse(parsed.event);
    return {
      type: envelope.eventType,
      version: Number(envelope.schemaVersion),
      data: envelope.payload || {},
      envelope,
    };
  }

  // Backward compatibility for any events written in the earlier split-field
  // representation.
  return { type: parsed.type, version: Number(parsed.version), data: JSON.parse(parsed.data || '{}') };
}

function handleProfileEvent(event) {
  const { type, data, version } = event;
  if (version !== 1) return;

  if (type === 'USER_REGISTERED.v1') {
    return profileService.createFromRegistration({
      userId: data.userId,
      name: data.name,
    });
  }

  if (type === 'USER_DELETED.v1') {
    return profileService.deleteForUser(data.userId);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function moveToDlq(redis, message) {
  try {
    const body = message.message;
    await redis.xadd(DLQ, '*', 'type', body.type, 'version', String(body.version), 'data', JSON.stringify(body.data));
    await redis.xack(STREAM, GROUP, message.id);
    logger.error('event_dlq', { messageId: message.id, type: body.type, reason: 'processing_failed' });
  } catch (err) {
    logger.error('event_dlq_write_failed', { messageId: message.id, message: err.message });
  }
}

export async function consumeProfileEvents({
  enabled = true,
  pollIntervalMs = 1000,
  shutdownSignal,
  redisClient = null,
} = {}) {
  if (!enabled) return { stop: async () => {} };

  // Blocking XREADGROUP commands must never share the request/cache client.
  // A dedicated connection prevents auth revocation and readiness commands
  // from queueing behind a five-second stream read.
  const ownsRedis = !redisClient;
  const redis = redisClient || getRedis().duplicate({ lazyConnect: true, maxRetriesPerRequest: null });
  if (ownsRedis) {
    redis.on('error', (err) => logger.error('consumer_redis_error', { message: err.message }));
    await redis.connect();
  }

  let running = enabled;
  let stopped = false;

  await redis.xgroup('CREATE', STREAM, GROUP, '0', 'MKSTREAM').catch(() => {});

  async function claimStale() {
    for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt += 1) {
      try {
        const results = await redis.xautoclaim(STREAM, GROUP, CONSUMER, 30000, '0-0', 'COUNT', 5);
        const pending = results[1] || [];
        for (const entry of pending) {
          const id = entry[0];
          const fields = entry[1] || [];
          const event = parseStreamEntry(fields);
          try {
            await handleProfileEvent(event);
            await redis.xack(STREAM, GROUP, id);
          } catch (err) {
            logger.error('stale_event_failed', { messageId: id, type: event.type, message: err.message });
            await moveToDlq(redis, { id, message: event });
          }
        }
      } catch (err) {
        logger.warn('xautoclaim_failed', { message: err.message });
        break;
      }
    }
  }

  async function poll() {
    try {
      await claimStale();

      const pendingResults = await redis.xreadgroup('GROUP', GROUP, CONSUMER, 'COUNT', BATCH_SIZE, 'BLOCK', 5000, 'STREAMS', STREAM, '>');
      if (!pendingResults) return;

      for (const [, entries] of pendingResults) {
        for (const entry of entries) {
          const id = entry[0];
          const fields = entry[1] || [];
          let event;
          try {
            event = parseStreamEntry(fields);
            await handleProfileEvent(event);
            await redis.xack(STREAM, GROUP, id);
            logger.debug('event_processed', { messageId: id, type: event.type });
          } catch (err) {
            logger.error('event_processing_failed', { messageId: id, type: event?.type, message: err.message });
            if (event) await moveToDlq(redis, { id, message: event });
            else await redis.xack(STREAM, GROUP, id);
          }
        }
      }
    } catch (err) {
      if (running) logger.warn('event_poll_failed', { message: err.message });
      throw err;
    }
  }

  logger.info('profile_event_consumer_started', { stream: STREAM, group: GROUP });

  // Exactly one poll is active at a time. The previous setInterval started a
  // new blocking read every second and built an unbounded command queue.
  const loopPromise = (async () => {
    while (running) {
      try {
        await poll();
      } catch {
        if (running) await sleep(pollIntervalMs);
      }
    }
  })();

  async function stop() {
    if (stopped) return;
    stopped = true;
    running = false;
    // disconnect() immediately releases a pending BLOCK read.
    if (ownsRedis) redis.disconnect();
    await loopPromise.catch(() => {});
    logger.info('profile_event_consumer_stopped', {});
  }

  if (shutdownSignal) {
    if (typeof shutdownSignal.then === 'function') shutdownSignal.then(() => void stop());
    else if (typeof shutdownSignal.on === 'function') shutdownSignal.on('SIGTERM', () => void stop());
  }

  return { stop };
}
