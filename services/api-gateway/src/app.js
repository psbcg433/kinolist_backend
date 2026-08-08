import express from 'express';
import helmet from 'helmet';
import { requestId } from './middleware/requestId.js';
import { stripHopByHopHeaders } from './middleware/security.js';
import { corsMiddleware } from './middleware/cors.js';
import { rateLimit } from './middleware/rateLimit.js';
import { bodyLimit } from './middleware/bodyLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import healthRouter from './routes/health.js';
import { proxyRoutes } from './routes/proxy.js';
import { logger } from './utils/logger.js';
import { config, isProduction } from './config/env.js';
import { ApiError } from './utils/ApiError.js';
import { sendSuccess } from './utils/response.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);
if (isProduction()) {
  app.use(helmet());
}

app.use(requestId);
app.use(stripHopByHopHeaders);
app.use(corsMiddleware());

// Basic per-IP gateway-level limiting before any upstream traffic.
app.use(rateLimit());

app.use(bodyLimit());

app.use((req, res, next) => {
  logger.debug('gateway_request', { requestId: req.id, method: req.method, url: req.originalUrl });
  next();
});

app.use('/health', healthRouter);

app.get('/', (req, res) => sendSuccess(req, res, { service: 'kinolist-api-gateway' }));

proxyRoutes(app);

// No route matched upstream — 404 in gateway envelope.
app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Route not found')));

app.use(errorHandler);

export default app;
