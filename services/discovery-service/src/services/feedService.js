import { movieClient } from '../providers/peerClients.js';
import { tasteDiveSimilar } from '../providers/tasteDiveProvider.js';
import { config } from '../config/env.js';
import { cached } from './discoveryCache.js';
import { logger } from '../utils/logger.js';
import { uniqueMovieSummaries } from '../utils/movieDto.js';

const FEED_LIMIT = 20;
const CURRENT_YEAR = () => new Date().getFullYear();

function searchItems(searchResult) {
  return Array.isArray(searchResult?.movies) ? searchResult.movies : [];
}

export const feedService = {
  async trending() {
    return cached('discovery:cache:v2:feed:trending', config.caches.feedTtl, async () => {
      const year = CURRENT_YEAR();
      const items = [];
      for (const y of [year, year - 1]) {
        try {
          items.push(...searchItems(await movieClient.search(String(y))));
        } catch (err) {
          logger.warn('feed_year_search_failed', { year: y, message: err.message });
        }
      }
      const movies = uniqueMovieSummaries(items, FEED_LIMIT);
      return { movies, total: movies.length };
    });
  },

  async byGenre(genre) {
    const key = `discovery:cache:v2:feed:genre:${encodeURIComponent(String(genre).toLowerCase())}`;
    return cached(key, config.caches.feedTtl, async () => {
      const recs = await tasteDiveSimilar(genre, { limit: config.limits.maxRecommendResolve });
      const names = (recs.similar.results || []).map((r) => r.name).filter(Boolean);

      const items = [];
      for (const name of names.slice(0, config.limits.maxRecommendResolve)) {
        try {
          items.push(...searchItems(await movieClient.search(name)));
        } catch (err) {
          logger.warn('feed_genre_resolve_failed', { name, message: err.message });
        }
      }
      const movies = uniqueMovieSummaries(items, FEED_LIMIT);
      return { movies, total: movies.length };
    });
  },

  async ongoing() {
    return cached('discovery:cache:v2:feed:ongoing', config.caches.feedTtl, async () => {
      const year = CURRENT_YEAR();
      return movieClient.search(String(year));
    });
  },

  async discover() {
    return cached('discovery:cache:v2:feed:discover', config.caches.feedTtl, async () => {
      const year = CURRENT_YEAR();
      const [searchRes, similar] = await Promise.all([
        movieClient.search(String(year)).catch(() => ({ movies: [], total: 0 })),
        tasteDiveSimilar('movies', { limit: 10 }).catch(() => ({ similar: { results: [] } })),
      ]);
      const items = [...searchItems(searchRes)];
      for (const result of similar.similar.results || []) {
        try {
          items.push(...searchItems(await movieClient.search(result.name)));
        } catch (err) {
          logger.warn('feed_discover_resolve_failed', { name: result.name, message: err.message });
        }
      }
      const movies = uniqueMovieSummaries(items, FEED_LIMIT);
      return { movies, total: movies.length };
    });
  },
};
