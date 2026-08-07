import { config } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { connectRedis } from './config/redis.js';
import { createApp } from './app.js';
import { consumeLibraryEvents } from './events/consumers/libraryConsumer.js';
import { logger } from './utils/logger.js';

async function main() {
  await connectDB();
  await connectRedis();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info('library_service_started', { port: config.port });
  });

  const consumer = await consumeLibraryEvents();

  async function shutdown(signal) {
    logger.info('library_service_shutting_down', { signal });
    consumer.stop();
    server.close(async () => {
      try {
        await disconnectDB();
      } finally {
        process.exit(0);
      }
    });
    setTimeout(() => process.exit(1), 10000).unref();
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('library_service_boot_failed', { message: err.message, stack: err.stack });
  process.exit(1);
});
