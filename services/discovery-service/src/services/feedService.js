import { movieClient } from '../providers/peerClients.js';
import { tasteDiveSimilar } from '../providers/tasteDiveProvider.js';
import { config } from '../config/env.js';
import { cached } from './discoveryCache.js';
import { logger } from '../utils/logger.js';

const FEED_LIMIT = 20;
const CURRENT_YEAR = () => new Date().getFullYear();

function uniqueMovies(list) {
  const seen = new Set();
  const out = [];
  for (const movie of list) {
    const id = movie.imdbID || movie.id || movie.Title || JSON.stringify(movie);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(movie);
  }
  return out.slice(0, FEED_LIMIT);
}

function searchItems(searchResult) {
  return Array.isArray(searchResult?.Search) ? searchResult.Search : [];
}

export const feedService = {
  async trending() {
    return cached(`discovery:cache:feed:trending`, config.caches.feedTtl, async () => {
      const year = CURRENT_YEAR();
      const items = [];
      for (const y of [year, year - 1]) {
        try {
          items.push(...searchItems(await movieClient.search(String(y))));
        } catch (err) {
          logger.warn('feed_year_search_failed', { year: y, message: err.message });
        }
      }
      return uniqueMovies(items);
    });
  },

  async byGenre(genre) {
    const key = `discovery:cache:feed:genre:${encodeURIComponent(String(genre).toLowerCase())}`;
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
      return uniqueMovies(items);
    });
  },

  async ongoing() {
    return cached('discovery:cache:feed:ongoing', config.caches.feedTtl, async () => {
      const year = CURRENT_YEAR();
      return movieClient.search(String(year));
    });
  },

  async discover() {
    return cached('discovery:cache:feed:discover', config.caches.feedTtl, async () => {
      const year = CURRENT_YEAR();
      const [searchRes, similar] = await Promise.all([
        movieClient.search(String(year)).catch(() => ({ Search: [] })),
        tasteDiveSimilar('movies', { limit: 10 }).catch(() => ({ similar: { results: [] } })),
      ]);
      return { popular: searchItems(searchRes), similar };
    });
  },
};
