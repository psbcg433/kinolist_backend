import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth.router.js';
import { requestId } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import { config } from './config/env.js';

const app = express();

app.disable('x-powered-by');
if (config.isProduction()) {
  app.use(helmet());
}

app.use(requestId);
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  logger.debug('auth_request', { requestId: req.id, method: req.method, url: req.originalUrl });
  next();
});

app.get('/health/live', (_req, res) => {
  res.status(200).json({ success: true, data: { status: 'ok' }, meta: {} });
});

app.get('/health/ready', async (req, res) => {
  const { default: mongoose } = await import('mongoose');
  const { getRedis } = await import('./config/redis.js');
  try {
    const mongoOk = mongoose.connection.readyState === 1;
    await getRedis().ping();
    if (!mongoOk) throw new Error('mongo not ready');
    res.status(200).json({ success: true, data: { status: 'ready' }, meta: {} });
  } catch {
    res.status(503).json({
      success: false,
      error: { code: 'NOT_READY', message: 'Dependency unavailable' },
      requestId: req.id,
    });
  }
});

app.use('/', authRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found', details: [] },
    requestId: req.id || null,
  });
});

app.use(errorHandler);

export default app;
