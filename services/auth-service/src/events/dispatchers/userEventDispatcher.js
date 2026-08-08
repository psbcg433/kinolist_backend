import { publishEvent } from '../publishers/userEvents.js';
import { userRepository } from '../../repositories/userRepository.js';
import { logger } from '../../utils/logger.js';

export async function dispatchPendingUserEvents({
  userId = null,
  limit = 25,
  repository = userRepository,
  publish = publishEvent,
} = {}) {
  const users = await repository.listWithPendingEvents({ userId, limit });
  let published = 0;

  for (const user of users) {
    // Preserve per-user event order: a delayed registration event must be
    // emitted before a later deletion event for the same account.
    for (const event of user.pendingEvents || []) {
      const succeeded = await publish(event);
      if (!succeeded) break;
      await repository.acknowledgePendingEvent(user._id, event.eventId);
      published += 1;
    }
  }

  return published;
}

export function startUserEventDispatcher({ intervalMs = 1000 } = {}) {
  let running = true;
  let timer = null;
  let active = Promise.resolve();

  const schedule = () => {
    if (!running) return;
    timer = setTimeout(() => {
      active = dispatchPendingUserEvents()
        .catch((err) => logger.error('event_outbox_dispatch_failed', { message: err.message }))
        .finally(schedule);
    }, intervalMs);
    timer.unref?.();
  };

  active = dispatchPendingUserEvents()
    .catch((err) => logger.error('event_outbox_dispatch_failed', { message: err.message }))
    .finally(schedule);

  return {
    async stop() {
      running = false;
      if (timer) clearTimeout(timer);
      await active.catch(() => {});
    },
  };
}
