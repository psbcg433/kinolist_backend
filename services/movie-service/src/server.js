import { config } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { connectRedis } from './config/redis.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

async function main() {
  await connectDB();
  await connectRedis();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info('movie_service_started', { port: config.port });
  });

  async function shutdown(signal) {
    logger.info('movie_service_shutting_down', { signal });
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
  logger.error('movie_service_boot_failed', { message: err.message, stack: err.stack });
  process.exit(1);
});
