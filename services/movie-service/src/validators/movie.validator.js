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
  let page = 1;
  if (query?.page !== undefined && query.page !== '') {
    page = parseInt(String(query.page), 10);
    if (Number.isNaN(page) || page < 1 || page > 100) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'page must be an integer between 1 and 100');
    }
  }
  return { query: q, type, year, page };
}

export function validateCatalogQuery(query) {
  const genre = typeof query?.genre === 'string' ? query.genre.trim() : '';
  if (genre.length > 40) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'genre must be at most 40 characters');
  }

  let minYear;
  if (query?.minYear !== undefined && query.minYear !== '') {
    minYear = parseInt(String(query.minYear), 10);
    if (Number.isNaN(minYear) || minYear < 1900 || minYear > 2100) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'minYear must be a valid year');
    }
  }

  const sort = typeof query?.sort === 'string' && query.sort ? query.sort : 'popular';
  if (!['popular', 'rating', 'recent'].includes(sort)) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'sort must be popular, rating or recent');
  }

  const limit = query?.limit === undefined || query.limit === '' ? 20 : parseInt(String(query.limit), 10);
  if (Number.isNaN(limit) || limit < 1 || limit > 50) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'limit must be an integer between 1 and 50');
  }
  return { genre: genre.toLowerCase(), minYear, sort, limit };
}
