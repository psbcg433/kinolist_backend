import { randomUUID } from 'node:crypto';
import { getRedis } from '../../config/redis.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export function buildEnvelope(eventType, producer, payload, correlationId = null, causationId = null) {
  return {
    eventId: randomUUID(),
    eventType,
    schemaVersion: 1,
    occurredAt: new Date().toISOString(),
    producer,
    correlationId,
    causationId,
    payload,
  };
}

export async function publishEvent(envelope) {
  try {
    const redis = getRedis();
    await redis.xadd(config.redis.stream, '*', 'event', JSON.stringify(envelope));
    logger.info('event_published', { eventType: envelope.eventType, eventId: envelope.eventId });
    return true;
  } catch (err) {
    // A durable user already exists; a missed event is a consistency issue that
    // must be surfaced loudly, not silently swallowed.
    logger.error('event_publish_failed', {
      eventType: envelope.eventType,
      eventId: envelope.eventId,
      message: err.message,
    });
    return false;
  }
}

export function buildUserRegisteredEvent(user, { correlationId = null } = {}, extra = {}) {
  return buildEnvelope(
    'USER_REGISTERED.v1',
    'auth-service',
    {
      userId: String(user._id),
      email: user.email,
      ...(extra.name ? { name: extra.name } : {}),
    },
    correlationId
  );
}

export function buildUserDeletedEvent(userId, { correlationId = null } = {}) {
  return buildEnvelope(
    'USER_DELETED.v1',
    'auth-service',
    { userId: String(userId) },
    correlationId
  );
}
