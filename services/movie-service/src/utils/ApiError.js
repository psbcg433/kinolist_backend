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
  const isClientError = status >= 400 && status < 500;
  return {
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: isClientError ? err.message : 'Internal server error',
      details: err.details || [],
    },
    requestId: requestId || null,
    message: isClientError ? err.message : 'Internal server error',
  };
}
