import { errorBody } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, _next) {
  let status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;

  if (status === 500) {
    if (err.name === 'CastError') {
      status = 400;
      err.status = 400;
      err.code = 'INVALID_ID';
      err.message = 'Invalid identifier';
    } else if (err.code === 11000) {
      status = 409;
      err.status = 409;
      err.code = 'CONFLICT';
      err.message = 'A playlist with this name already exists';
    } else if (err.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      err.status = 413;
      err.code = 'PAYLOAD_TOO_LARGE';
      err.message = 'Payload exceeds the size limit';
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

  res.status(status).json(errorBody(err, req.id));
}
