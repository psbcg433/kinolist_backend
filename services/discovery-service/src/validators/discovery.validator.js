import { ApiError } from '../utils/ApiError.js';

export function validateSearchQuery(query) {
  const q = typeof query?.q === 'string' ? query.q.trim() : '';
  if (!q || q.length > 120) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Search query (q) is required and must be at most 120 characters');
  }
  return q;
}

export function validateGenre(genre) {
  if (typeof genre !== 'string' || !genre.trim() || genre.length > 40) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'A genre is required');
  }
  return genre.trim().toLowerCase();
}

export function validateUserId(userId, authUserId) {
  if (userId !== authUserId) {
    throw new ApiError(403, 'FORBIDDEN', 'You cannot view another user\u2019s recommendations');
  }
  return userId;
}
