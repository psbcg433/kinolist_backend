import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

function normalizeResult(result) {
  return {
    name: result.Name || result.name || '',
    type: result.Type || result.type || '',
    wTeaser: result.wTeaser || '',
    wUrl: result.wUrl || '',
    yUrl: result.yUrl || '',
    yID: result.yID || '',
  };
}

/**
 * TasteDive client. Returns a normalized response shaped as
 * `{ similar: { results: [...] } }` so the legacy frontend contract
 * (`recommendations?.similar?.results`) works unchanged.
 */
export async function tasteDiveSimilar(seed, { limit = 10 } = {}) {
  const params = new URLSearchParams({
    q: seed,
    k: config.tasteDive.apiKey,
    type: 'movie',
    limit: String(limit),
  });
  const url = `${config.tasteDive.baseUrl}?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.tasteDive.timeoutMs);

  let response;
  try {
    response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
  } catch (err) {
    const timedOut = err.name === 'AbortError';
    logger.error('tastedive_request_failed', { seed, timedOut, message: err.message });
    throw new ApiError(502, 'UPSTREAM_UNAVAILABLE', timedOut ? 'Recommendation provider timed out' : 'Recommendation provider unavailable');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    logger.error('tastedive_http_error', { seed, status: response.status });
    throw new ApiError(502, 'UPSTREAM_UNAVAILABLE', 'Recommendation provider returned an error');
  }

  const body = await response.json();
  const results = body?.Similar?.Results || body?.similar?.results || [];
  return {
    similar: {
      results: results.map(normalizeResult),
    },
  };
}
