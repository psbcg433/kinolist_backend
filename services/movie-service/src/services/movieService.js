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

function isStoredMovieFresh(movie) {
  if (!movie?.data || !movie.fetchedAt) return false;
  const fetchedAt = new Date(movie.fetchedAt).getTime();
  if (!Number.isFinite(fetchedAt)) return false;
  return Date.now() - fetchedAt < config.cache.dbMaxAgeSeconds * 1000;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function numericField(value) {
  const parsed = Number.parseFloat(String(value || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function releaseYear(movie) {
  const parsed = Number.parseInt(String(movie?.Year || '').slice(0, 4), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function releaseTimestamp(movie) {
  const released = Date.parse(String(movie?.Released || ''));
  if (Number.isFinite(released)) return released;
  const year = releaseYear(movie);
  return year ? Date.UTC(year, 0, 1) : 0;
}

function sortCatalog(movies, sort) {
  return movies.sort((a, b) => {
    if (sort === 'recent') {
      return releaseTimestamp(b) - releaseTimestamp(a)
        || numericField(b.imdbVotes) - numericField(a.imdbVotes);
    }
    if (sort === 'rating') {
      return numericField(b.imdbRating) - numericField(a.imdbRating)
        || numericField(b.imdbVotes) - numericField(a.imdbVotes);
    }
    const popularityA = numericField(a.imdbVotes) * Math.max(numericField(a.imdbRating), 1);
    const popularityB = numericField(b.imdbVotes) * Math.max(numericField(b.imdbRating), 1);
    return popularityB - popularityA;
  });
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
    if (isStoredMovieFresh(stored)) {
      await setCache(cacheKey(imdbID), stored.data, config.cache.ttlSeconds);
      return stored.data;
    }

    try {
      const fresh = await fetchOmdb(imdbID);
      await movieRepository.upsert(imdbID, fresh);
      await setCache(cacheKey(imdbID), fresh, config.cache.ttlSeconds);
      return fresh;
    } catch (err) {
      if (!stored?.data) throw err;
      logger.warn('omdb_stale_fallback', { imdbID, message: err.message });
      await setCache(cacheKey(imdbID), stored.data, config.cache.staleIfErrorSeconds);
      return stored.data;
    }
  },

  async search(query, { type, year, page = 1 } = {}) {
    const key = searchCacheKey(`${query}|${type || ''}|${year || ''}|${page}`);
    const cached = await getCache(key);
    if (cached) return cached;

    const result = await searchOmdb(query, { type, year, page });
    await setCache(key, result, config.cache.ttlSeconds);
    return result;
  },

  /** Browse the local, provider-backed catalogue without spending OMDb quota. */
  async catalog({ genre, minYear, sort = 'popular', limit = 20 } = {}) {
    const stored = await movieRepository.listCached(250);
    const movies = stored
      .map((entry) => entry.data)
      .filter(Boolean)
      .filter((movie) => !genre || String(movie.Genre || '')
        .split(',')
        .some((item) => item.trim().toLowerCase() === genre))
      .filter((movie) => !minYear || releaseYear(movie) >= minYear);
    return sortCatalog(movies, sort).slice(0, limit);
  },

  /** Resolves many ids; individual failures resolve to null (never throw). */
  async batch(ids) {
    const entries = await mapWithConcurrency(
      ids,
      config.limits.batchConcurrency,
      async (imdbID) => {
        try {
          return [imdbID, await this.getById(imdbID)];
        } catch (err) {
          logger.warn('movie_batch_item_failed', { imdbID, message: err.message });
          return [imdbID, null];
        }
      }
    );
    return Object.fromEntries(entries);
  },
};
