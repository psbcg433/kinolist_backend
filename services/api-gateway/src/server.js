import app from './app.js';
import { config, isProduction } from './config/env.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { logger } from './utils/logger.js';

async function main() {
  const environment = isProduction() ? 'production' : 'development';
  logger.info('starting', { service: 'api-gateway', environment, port: config.port });

  let server;
  try {
    await connectRedis();
    server = app.listen(config.port, () => {
      logger.info('listening', { port: config.port });
    });
  } catch (err) {
    logger.error('startup_failed', { message: err.message, stack: err.stack });
    process.exit(1);
  }

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('shutdown_start', { signal });
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    server.close(async () => {
      await disconnectRedis().catch(() => {});
      logger.info('shutdown_complete', {});
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
