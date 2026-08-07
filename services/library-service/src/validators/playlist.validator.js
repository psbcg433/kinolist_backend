import { ApiError } from '../utils/ApiError.js';

const IMDB_ID_RE = /^tt\d{7,10}$/;

export function validateCreate(body) {
  const name = body?.name;
  if (typeof name !== 'string' || !name.trim()) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Playlist name is required', [{ field: 'name', code: 'REQUIRED' }]);
  }
  const cleaned = name.trim();
  if (cleaned.length > 120) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Playlist name must be at most 120 characters', [{ field: 'name', code: 'TOO_LONG' }]);
  }
  let description = '';
  if (body?.description !== undefined && body?.description !== null) {
    if (typeof body.description !== 'string') {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Description must be a string', [{ field: 'description', code: 'INVALID_TYPE' }]);
    }
    description = body.description.trim().slice(0, 500);
  }
  return { name: cleaned, description };
}

export function validateLegacyCreate(body) {
  const type = typeof body?.type === 'string' ? body.type.trim().toLowerCase() : '';
  if (!type) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Playlist type is required', [{ field: 'type', code: 'REQUIRED' }]);
  }
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (!title) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Playlist title is required', [{ field: 'title', code: 'REQUIRED' }]);
  }
  if (title.length > 120) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Playlist title must be at most 120 characters', [{ field: 'title', code: 'TOO_LONG' }]);
  }
  return { type, title };
}

export function validateUpdate(body) {
  const payload = {};
  if (body?.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Playlist name cannot be empty', [{ field: 'name', code: 'REQUIRED' }]);
    }
    const name = body.name.trim();
    if (name.length > 120) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Playlist name must be at most 120 characters', [{ field: 'name', code: 'TOO_LONG' }]);
    }
    payload.name = name;
  }
  if (body?.description !== undefined) {
    if (typeof body.description !== 'string') {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Description must be a string', [{ field: 'description', code: 'INVALID_TYPE' }]);
    }
    payload.description = body.description.trim().slice(0, 500);
  }
  return payload;
}

export function validateItem(body) {
  const imdbID = body?.imdbID;
  if (typeof imdbID !== 'string' || !IMDB_ID_RE.test(imdbID)) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'A valid imdbID (e.g. tt0111161) is required', [{ field: 'imdbID', code: 'INVALID_FORMAT' }]);
  }
  let title = '';
  if (body?.title !== undefined) {
    if (typeof body.title !== 'string') {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Title must be a string', [{ field: 'title', code: 'INVALID_TYPE' }]);
    }
    title = body.title.trim().slice(0, 300);
  }
  let posterUrl = '';
  if (body?.posterUrl !== undefined) {
    if (typeof body.posterUrl !== 'string') {
      throw new ApiError(400, 'VALIDATION_FAILED', 'posterUrl must be a string', [{ field: 'posterUrl', code: 'INVALID_TYPE' }]);
    }
    posterUrl = body.posterUrl.trim().slice(0, 500);
  }
  return { imdbID, title, posterUrl };
}

/** Legacy add body is `{ movie: { imdbID, title, data } }`. */
export function validateLegacyItem(body) {
  const movie = body?.movie;
  if (!movie || typeof movie !== 'object') {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Movie is required', [{ field: 'movie', code: 'REQUIRED' }]);
  }
  return validateItem({
    imdbID: movie.imdbID,
    title: movie.title,
    posterUrl: movie.Poster || movie.posterUrl,
  });
}

export function normalizeLegacyType(type) {
  return String(type || '').toLowerCase();
}
