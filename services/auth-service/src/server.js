import app from './app.js';
import { config } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { logger } from './utils/logger.js';
import User from './models/user.model.js';
import Session from './models/session.model.js';
import RefreshToken from './models/refreshToken.model.js';
import RevokedToken from './models/revokedToken.model.js';
import AuthLog from './models/authLog.model.js';

async function main() {
  logger.info('starting', {
    service: 'auth-service',
    environment: config.nodeEnv,
    port: config.port,
  });

  let server;
  try {
    await connectDB();
    await Promise.all([
      User.createIndexes(),
      Session.createIndexes(),
      RefreshToken.createIndexes(),
      RevokedToken.createIndexes(),
      AuthLog.createIndexes(),
    ]);
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
      await Promise.allSettled([disconnectDB(), disconnectRedis()]);
      logger.info('shutdown_complete', {});
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
