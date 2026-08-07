import { ApiError } from '../utils/ApiError.js';

export const IMDB_ID_RE = /^tt\d{7,10}$/;

export function validateImdbID(value) {
  if (typeof value !== 'string' || !IMDB_ID_RE.test(value)) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'A valid imdbID (e.g. tt0111161) is required');
  }
  return value;
}

export function validateBatchIds(body) {
  const ids = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 20) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Provide between 1 and 20 imdbIDs');
  }
  const unique = [...new Set(ids)];
  return unique.map((id) => validateImdbID(id));
}

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
  return { query: q, type, year };
}
