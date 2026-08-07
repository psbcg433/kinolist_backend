import { libraryClient, movieClient } from '../providers/peerClients.js';
import { tasteDiveSimilar } from '../providers/tasteDiveProvider.js';
import { searchHistoryRepository } from '../repositories/searchHistoryRepository.js';
import { config } from '../config/env.js';
import { cached } from './discoveryCache.js';
import { logger } from '../utils/logger.js';

/**
 * Enriches TasteDive results with OMDb snapshots (Title/Poster/imdbID) so the
 * legacy frontend's MovieGrid renders properly. Never persisted.
 */
async function enrich(results) {
  const enriched = [];
  for (const result of results.slice(0, config.limits.maxRecommendResolve)) {
    try {
      const search = await movieClient.search(result.name);
      const hit = search?.Search?.[0];
      if (hit) {
        enriched.push({ ...result, Title: hit.Title, Poster: hit.Poster, imdbID: hit.imdbID, Year: hit.Year });
        continue;
      }
    } catch (err) {
      logger.warn('recommend_resolve_failed', { name: result.name, message: err.message });
    }
    enriched.push(result);
  }
  return enriched;
}

async function recommend(seed, key) {
  return cached(key, config.caches.recommendTtl, async () => {
    const recs = await tasteDiveSimilar(seed, { limit: 12 });
    return { similar: { results: await enrich(recs.similar.results) } };
  });
}

export const recommendService = {
  async fromLastSearch(userId) {
    const history = await searchHistoryRepository.findByUserId(userId);
    if (!history?.lastSearched) return { recommendations: [] };
    const recommendations = await recommend(history.lastSearched, `discovery:cache:recommend:last-search:${userId}`);
    return { recommendations };
  },

  async fromSearchHistory(userId) {
    const history = await searchHistoryRepository.findByUserId(userId);
    const queries = (history?.queries || []).slice(-5).map((q) => q.q).filter(Boolean);
    if (!queries.length) return { recommendations: [] };
    const recommendations = await recommend(queries.join(','), `discovery:cache:recommend:search-history:${userId}`);
    return { recommendations };
  },

  async fromPlaylist(userId, type) {
    const items = await libraryClient.items(userId, [type]);
    const seeds = (items[type] || []).slice(0, 3).map((m) => m.title).filter(Boolean);
    if (!seeds.length) return { recommendations: [] };
    const recommendations = await recommend(seeds.join(','), `discovery:cache:recommend:${type}:${userId}`);
    return { recommendations };
  },
};
