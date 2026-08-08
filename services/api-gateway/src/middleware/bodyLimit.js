import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export function bodyLimit() {
  return function bodyLimitMiddleware(req, res, next) {
    // The proxy does not buffer bodies, so a chunked request cannot be counted
    // safely here. Reject it instead of allowing Content-Length bypasses and
    // unbounded multipart/text streams into upstream memory.
    if (req.hadTransferEncoding) {
      return next(new ApiError(411, 'CONTENT_LENGTH_REQUIRED', 'Chunked request bodies are not accepted'));
    }

    const declared = req.headers['content-length'];
    if (declared !== undefined) {
      const length = Number(declared);
      if (!Number.isSafeInteger(length) || length < 0) {
        return next(new ApiError(400, 'INVALID_CONTENT_LENGTH', 'Content-Length must be a non-negative integer'));
      }
      if (length > config.maxBodyBytes) {
        return next(new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds the size limit'));
      }
    }

    return next();
  };
}
