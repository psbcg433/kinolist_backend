import cors from 'cors';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export function corsMiddleware() {
  const origins = new Set(config.frontendOrigins);
  return cors({
    origin(origin, callback) {
      if (!origin || origins.has(origin)) {
        return callback(null, true);
      }
      return callback(new ApiError(403, 'CORS_ORIGIN_DENIED', 'Origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Request-Id',
      'Accept',
    ],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  });
}
