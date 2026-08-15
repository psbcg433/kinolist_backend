import { ApiError } from '../utils/ApiError.js';

export function validateSearchQuery(query) {
  const q = typeof query?.q === 'string' ? query.q.trim() : '';
  if (!q || q.length > 120) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Search query (q) is required and must be at most 120 characters');
  }
  let type;
  if (query?.type !== undefined && query.type !== '') {
    type = String(query.type);
    if (!['movie', 'series', 'episode'].includes(type)) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'type must be movie, series or episode');
    }
  }
  let year;
  if (query?.y !== undefined && query.y !== '') {
    year = parseInt(String(query.y), 10);
    if (Number.isNaN(year) || year < 1900 || year > 2100) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'year (y) must be a valid year');
    }
  }
  let page = 1;
  if (query?.page !== undefined && query.page !== '') {
    page = parseInt(String(query.page), 10);
    if (Number.isNaN(page) || page < 1 || page > 100) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'page must be an integer between 1 and 100');
    }
  }
  let limit;
  if (query?.limit !== undefined && query.limit !== '') {
    limit = parseInt(String(query.limit), 10);
    if (Number.isNaN(limit) || limit < 1 || limit > 10) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'limit must be an integer between 1 and 10');
    }
  }
  const preview = String(query?.preview || '').toLowerCase() === 'true';
  return { query: q, type, year, page, preview, limit };
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
