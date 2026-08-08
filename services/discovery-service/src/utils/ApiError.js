export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorBody(err, requestId) {
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  const isExpected = err instanceof ApiError || status < 500;
  return {
    success: false,
    error: {
      code: isExpected ? (err.code || 'REQUEST_FAILED') : 'INTERNAL_ERROR',
      message: isExpected ? err.message : 'Internal server error',
      details: isExpected && Array.isArray(err.details) ? err.details : [],
    },
    requestId: requestId || null,
  };
}
