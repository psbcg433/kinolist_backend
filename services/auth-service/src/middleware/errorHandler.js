import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, _next) {
  let status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message;

  if (status === 500) {
    if (err.name === 'CastError') {
      status = 400;
      code = 'INVALID_ID';
      message = 'Invalid identifier';
    } else if (err.code === 11000) {
      status = 409;
      code = 'CONFLICT';
      message = 'A record with this value already exists';
    }
  }

  if (status >= 500) {
    logger.error('request_failed', {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      message: err.message,
      stack: err.stack,
    });
  }

  const isClientError = status >= 400 && status < 500;
  res.status(status).json({
    success: false,
    error: {
      code,
      message: isClientError ? message : 'Internal server error',
      details: err.details || [],
    },
    requestId: req.id || null,
    message: isClientError ? message : 'Internal server error',
  });
}

export { ApiError };
