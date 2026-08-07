import express from 'express';
import mongoose from 'mongoose';
import { requestId } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import searchRouter from './routes/search.router.js';
import feedRouter from './routes/feed.router.js';
import recommendRouter from './routes/recommend.router.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use(requestId);

  app.get('/health/live', (_req, res) => {
    res.json({ status: 'ok', service: 'discovery-service' });
  });

  app.get('/health/ready', async (_req, res) => {
    try {
      const [dbState, redisPing] = await Promise.all([
        mongoose.connection.readyState === 1 ? Promise.resolve('up') : Promise.reject(new Error('mongo not connected')),
        import('./config/redis.js').then((m) => m.getRedis().ping()),
      ]);
      res.json({ status: 'ok', service: 'discovery-service', db: dbState, redis: redisPing ? 'up' : 'down' });
    } catch (err) {
      res.status(503).json({ status: 'unavailable', service: 'discovery-service', reason: err.message });
    }
  });

  app.use(express.json({ limit: '100kb' }));

  app.use('/api/search', searchRouter);
  app.use('/api/feed', feedRouter);
  app.use('/api/recommend', recommendRouter);

  app.use((req, res) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' }, message: 'Route not found' });
  });

  app.use(errorHandler);

  return app;
}
