import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export function bodyLimit() {
  return function bodyLimitMiddleware(req, res, next) {
    const declared = req.headers['content-length'];
    if (declared && Number(declared) > config.maxBodyBytes) {
      return next(new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds the size limit'));
    }
    return next();
  };
}
