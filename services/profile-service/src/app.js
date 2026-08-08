import express from 'express';
import mongoose from 'mongoose';
import { requestId } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import profileRouter from './routes/profile.router.js';
import { ApiError } from './utils/ApiError.js';
import { sendSuccess } from './utils/response.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

  app.use(requestId);

  app.get('/health/live', (req, res) => {
    sendSuccess(req, res, { status: 'ok', service: 'profile-service' });
  });

  app.get('/health/ready', async (req, res, next) => {
    try {
      await Promise.all([
        mongoose.connection.readyState === 1
          ? Promise.resolve('up')
          : Promise.reject(new Error('mongo not connected')),
        import('./config/redis.js').then((m) => m.getRedis().ping()),
      ]);
      sendSuccess(req, res, { status: 'ready', service: 'profile-service' });
    } catch (err) {
      next(new ApiError(503, 'NOT_READY', 'Dependency unavailable'));
    }
  });

  app.use(express.json({ limit: '100kb' }));

  app.use('/api/user', profileRouter);

  app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Route not found')));

  app.use(errorHandler);

  return app;
}
