import { getRedis } from '../config/redis.js';
import { playlistService } from '../services/playlistService.js';
import { logger } from '../utils/logger.js';

const STREAM = 'kinolist:stream:domain-events';
const GROUP = 'library-consumer';
const CONSUMER = `library-worker-${process.pid}`;
const DLQ = 'kinolist:stream:domain-events:dlq';

const BATCH_SIZE = 10;
const CLAIM_ATTEMPTS = 3;

function handleLibraryEvent(event) {
  const { type, data, version } = event;
  if (version !== 1) return;

  if (type === 'USER_DELETED.v1') {
    return playlistService.deleteForUser(data.userId);
  }
}

async function moveToDlq(message) {
  try {
    const redis = getRedis();
    const body = message.message;
    await redis.xadd(DLQ, '*', 'type', body.type, 'version', String(body.version), 'data', JSON.stringify(body.data));
    await redis.xack(STREAM, GROUP, message.id);
    logger.error('event_dlq', { messageId: message.id, type: body.type, reason: 'processing_failed' });
  } catch (err) {
    logger.error('event_dlq_write_failed', { messageId: message.id, message: err.message });
  }
}

export async function consumeLibraryEvents({ enabled = true, pollIntervalMs = 1000, shutdownSignal } = {}) {
  const redis = getRedis();
  let running = enabled;

  await redis.xgroup('CREATE', STREAM, GROUP, '0', 'MKSTREAM').catch(() => {});

  async function claimStale() {
    for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt += 1) {
      try {
        const results = await redis.xautoclaim(STREAM, GROUP, CONSUMER, 30000, '0-0', 'COUNT', 5);
        const pending = results[1] || [];
        for (const entry of pending) {
          const id = entry[0];
          const fields = entry[1] || [];
          const parsed = {};
          for (let i = 0; i < fields.length; i += 2) parsed[fields[i]] = fields[i + 1];
          const event = { type: parsed.type, version: Number(parsed.version), data: JSON.parse(parsed.data || '{}') };
          try {
            await handleLibraryEvent(event);
            await redis.xack(STREAM, GROUP, id);
          } catch (err) {
            logger.error('stale_event_failed', { messageId: id, type: event.type, message: err.message });
            await moveToDlq({ id, message: event });
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
          const parsed = {};
          for (let i = 0; i < fields.length; i += 2) parsed[fields[i]] = fields[i + 1];

          let event;
          try {
            event = { type: parsed.type, version: Number(parsed.version), data: JSON.parse(parsed.data || '{}') };
            await handleLibraryEvent(event);
            await redis.xack(STREAM, GROUP, id);
            logger.debug('event_processed', { messageId: id, type: event.type });
          } catch (err) {
            logger.error('event_processing_failed', { messageId: id, type: parsed.type, message: err.message });
            if (event) await moveToDlq({ id, message: event });
            else await redis.xack(STREAM, GROUP, id);
          }
        }
      }
    } catch (err) {
      logger.warn('event_poll_failed', { message: err.message });
    }
  }

  logger.info('library_event_consumer_started', { stream: STREAM, group: GROUP });

  const timer = setInterval(() => {
    if (running) void poll();
  }, pollIntervalMs);
  timer.unref();

  if (shutdownSignal) {
    const stop = () => {
      if (!running) return;
      running = false;
      clearInterval(timer);
      logger.info('library_event_consumer_stopped', {});
    };
    if (typeof shutdownSignal === 'function') shutdownSignal.then(stop);
    else shutdownSignal.on('SIGTERM', stop);
  }

  return { stop: () => { running = false; clearInterval(timer); } };
}
