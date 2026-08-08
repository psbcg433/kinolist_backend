import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

/**
 * Minimal internal HTTP client for peer services. Every call carries the
 * shared internal key and a hard timeout.
 */
async function peerRequest({ baseUrl, path, method = 'GET', body, timeout }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout || config.peers.internalTimeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'x-internal-key': config.internalKey,
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });

    let json = null;
    const text = await response.text();
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    if (!response.ok) {
      const code = json?.error?.code || 'PEER_ERROR';
      logger.error('peer_error', { baseUrl, path, status: response.status, code });
      throw new ApiError(502, 'PEER_ERROR', 'Upstream service returned an error');
    }
    return json;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const timedOut = err.name === 'AbortError';
    logger.error('peer_unavailable', { baseUrl, path, timedOut, message: err.message });
    throw new ApiError(502, 'PEER_UNAVAILABLE', timedOut ? 'Upstream service timed out' : 'Upstream service unavailable');
  } finally {
    clearTimeout(timer);
  }
}

export const movieClient = {
  async search(query, { type, year } = {}) {
    const params = new URLSearchParams({ q: query });
    if (type) params.set('type', type);
    if (year) params.set('y', String(year));
    const result = await peerRequest({ baseUrl: config.peers.movieServiceUrl, path: `/internal/movie/search?${params.toString()}` });
    return {
      movies: result?.data?.movies || [],
      total: Number(result?.meta?.total || 0),
    };
  },

  async batch(ids) {
    const result = await peerRequest({ baseUrl: config.peers.movieServiceUrl, path: '/internal/movie/batch', method: 'POST', body: { ids } });
    return result?.data?.moviesById || {};
  },
};

export const libraryClient = {
  async items(userId, types = ['favourites', 'watchlist']) {
    const result = await peerRequest({
      baseUrl: config.peers.libraryServiceUrl,
      path: `/internal/library/${encodeURIComponent(userId)}/items?types=${types.join(',')}`,
    });
    return result?.data?.itemsByType || { favourites: [], watchlist: [] };
  },
};
