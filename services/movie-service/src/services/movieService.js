import { getRedis } from '../config/redis.js';
import { movieRepository } from '../repositories/movieRepository.js';
import { fetchOmdb, searchOmdb } from '../providers/omdbProvider.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const inFlight = new Map();

function cacheKey(imdbID) {
  return `movie:cache:${imdbID}`;
}

function searchCacheKey(query) {
  return `movie:cache:search:${String(query).toLowerCase()}`;
}

async function getCache(key) {
  try {
    const raw = await getRedis().get(key);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    logger.warn('movie_cache_read_failed', { key, message: err.message });
  }
  return null;
}

async function setCache(key, data, ttlSeconds) {
  try {
    await getRedis().set(key, JSON.stringify(data), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn('movie_cache_write_failed', { key, message: err.message });
  }
}

export const movieService = {
  /** Redis cache first, single-flight per key, then Mongo, then OMDb. */
  async getById(imdbID) {
    const cached = await getCache(cacheKey(imdbID));
    if (cached) return cached;

    const pending = inFlight.get(imdbID);
    if (pending) return pending;

    const promise = this.resolve(imdbID).finally(() => inFlight.delete(imdbID));
    inFlight.set(imdbID, promise);
    return promise;
  },

  async resolve(imdbID) {
    const stored = await movieRepository.findByImdbID(imdbID);
    if (stored?.data) {
      await setCache(cacheKey(imdbID), stored.data, config.cache.ttlSeconds);
      return stored.data;
    }

    const fresh = await fetchOmdb(imdbID);
    await movieRepository.upsert(imdbID, fresh);
    await setCache(cacheKey(imdbID), fresh, config.cache.ttlSeconds);
    return fresh;
  },

  async search(query, { type, year } = {}) {
    const key = searchCacheKey(`${query}|${type || ''}|${year || ''}`);
    const cached = await getCache(key);
    if (cached) return cached;

    const result = await searchOmdb(query, { type, year });
    await setCache(key, result, config.cache.ttlSeconds);
    return result;
  },

  /** Resolves many ids; individual failures resolve to null (never throw). */
  async batch(ids) {
    const results = {};
    for (const imdbID of ids) {
      try {
        results[imdbID] = await this.getById(imdbID);
      } catch (err) {
        logger.warn('movie_batch_item_failed', { imdbID, message: err.message });
        results[imdbID] = null;
      }
    }
    return results;
  },
};
