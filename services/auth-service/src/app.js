import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth.router.js';
import { requestId } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import { config } from './config/env.js';
import { ApiError } from './utils/ApiError.js';
import { sendSuccess } from './utils/response.js';
import { emailService } from './services/emailService.js';

const app = express();

app.disable('x-powered-by');
// Services are reachable only through one proxy on a private/loopback network.
// This makes req.ip use the canonical X-Forwarded-For value set by the gateway
// without trusting forwarding headers from an internet-facing socket.
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
if (config.isProduction()) {
  app.use(helmet());
}

app.use(requestId);
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
});
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  logger.debug('auth_request', { requestId: req.id, method: req.method, url: req.originalUrl });
  next();
});

app.get('/health/live', (req, res) => {
  sendSuccess(req, res, { status: 'ok' });
});

app.get('/health/ready', async (req, res, next) => {
  const { default: mongoose } = await import('mongoose');
  const { getRedis } = await import('./config/redis.js');
  try {
    const mongoOk = mongoose.connection.readyState === 1;
    await Promise.all([getRedis().ping(), emailService.verifyConnection()]);
    if (!mongoOk) throw new Error('mongo not ready');
    sendSuccess(req, res, { status: 'ready' });
  } catch {
    next(new ApiError(503, 'NOT_READY', 'Dependency unavailable'));
  }
});

app.use('/', authRouter);

app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Route not found')));

app.use(errorHandler);

export default app;
