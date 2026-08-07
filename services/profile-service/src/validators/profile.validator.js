import { ApiError } from '../utils/ApiError.js';

const ALLOWED_FIELDS = new Set(['name', 'bio']);

/**
 * Validates a profile update. Only `name` and `bio` are ever accepted;
 * everything else (email, password, role, tokenVersion, 2FA state, userId,
 * profilePic/coverPic URLs supplied by the client) is ignored — never stored.
 */
export function validateProfileUpdate(body) {
  const payload = {};
  for (const [key, value] of Object.entries(body || {})) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string') {
      throw new ApiError(400, 'VALIDATION_FAILED', `Field ${key} must be a string`, [{ field: key, code: 'INVALID_TYPE' }]);
    }
    const cleaned = value.trim();
    if (key === 'name' && cleaned.length > 100) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Name must be at most 100 characters', [{ field: key, code: 'TOO_LONG' }]);
    }
    if (key === 'bio' && cleaned.length > 500) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Bio must be at most 500 characters', [{ field: key, code: 'TOO_LONG' }]);
    }
    payload[key] = cleaned;
  }
  return payload;
}
