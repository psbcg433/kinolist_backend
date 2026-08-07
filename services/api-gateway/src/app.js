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
import { isProduction } from './config/env.js';

const app = express();

app.disable('x-powered-by');
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

app.get('/', (_req, res) => res.status(200).json({ success: true, data: { service: 'kinolist-api-gateway' }, meta: {} }));

proxyRoutes(app);

// No route matched upstream — 404 in gateway envelope.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found', details: [] },
    requestId: req.id || null,
  });
});

app.use(errorHandler);

export default app;
