import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

/**
 * OMDb client with a hard timeout. HTTPS only, never passes the API key to
 * logs or downstream callers.
 */
async function request(params, label) {
  const urlParams = new URLSearchParams({ apikey: config.omdb.apiKey, ...params });
  const url = `${config.omdb.baseUrl}?${urlParams.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.omdb.timeoutMs);

  let response;
  try {
    response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
  } catch (err) {
    const timedOut = err.name === 'AbortError';
    logger.error('omdb_request_failed', { label, timedOut, message: err.message });
    throw new ApiError(timedOut ? 504 : 502, 'UPSTREAM_UNAVAILABLE', timedOut ? 'Movie provider timed out' : 'Movie provider unavailable');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    logger.error('omdb_http_error', { label, status: response.status });
    throw new ApiError(502, 'UPSTREAM_UNAVAILABLE', 'Movie provider returned an error');
  }

  return response.json();
}

export async function fetchOmdb(imdbID) {
  const body = await request({ i: imdbID, plot: 'full' }, imdbID);
  if (body.Response === 'False') {
    logger.info('omdb_not_found', { imdbID, error: body.Error });
    throw new ApiError(404, 'MOVIE_NOT_FOUND', body.Error || 'Movie not found');
  }
  logger.debug('omdb_fetched', { imdbID, title: body.Title });
  return body;
}

export async function searchOmdb(query, { type, year, page = 1 } = {}) {
  const params = { s: query, page: String(page) };
  if (type) params.type = type;
  if (year) params.y = String(year);
  const body = await request(params, `search:${query}`);
  if (body.Response === 'False') {
    return { Search: [], totalResults: '0', Response: 'False' };
  }
  return body;
}
