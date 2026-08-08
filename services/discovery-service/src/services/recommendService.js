import { libraryClient, movieClient } from '../providers/peerClients.js';
import { tasteDiveSimilar } from '../providers/tasteDiveProvider.js';
import { searchHistoryRepository } from '../repositories/searchHistoryRepository.js';
import { config } from '../config/env.js';
import { cached } from './discoveryCache.js';
import { logger } from '../utils/logger.js';
import { uniqueMovieSummaries } from '../utils/movieDto.js';

/**
 * Resolves TasteDive names to minimal movie summaries. Provider-specific
 * metadata and links are intentionally not exposed to API clients.
 */
async function enrich(results) {
  const enriched = [];
  for (const result of results.slice(0, config.limits.maxRecommendResolve)) {
    try {
      const search = await movieClient.search(result.name);
      const hit = search?.movies?.[0];
      if (hit) {
        enriched.push(hit);
      }
    } catch (err) {
      logger.warn('recommend_resolve_failed', { name: result.name, message: err.message });
    }
  }
  return uniqueMovieSummaries(enriched, config.limits.maxRecommendResolve);
}

async function recommend(seed, key) {
  return cached(key, config.caches.recommendTtl, async () => {
    const recs = await tasteDiveSimilar(seed, { limit: 12 });
    return enrich(recs.similar.results);
  });
}

export const recommendService = {
  async fromLastSearch(userId) {
    const history = await searchHistoryRepository.findByUserId(userId);
    if (!history?.lastSearched) return { movies: [] };
    const movies = await recommend(history.lastSearched, `discovery:cache:v2:recommend:last-search:${userId}`);
    return { movies };
  },

  async fromSearchHistory(userId) {
    const history = await searchHistoryRepository.findByUserId(userId);
    const queries = (history?.queries || []).slice(-5).map((q) => q.q).filter(Boolean);
    if (!queries.length) return { movies: [] };
    const movies = await recommend(queries.join(','), `discovery:cache:v2:recommend:search-history:${userId}`);
    return { movies };
  },

  async fromPlaylist(userId, type) {
    const items = await libraryClient.items(userId, [type]);
    const seeds = (items[type] || []).slice(0, 3).map((m) => m.title).filter(Boolean);
    if (!seeds.length) return { movies: [] };
    const movies = await recommend(seeds.join(','), `discovery:cache:v2:recommend:${type}:${userId}`);
    return { movies };
  },
};
