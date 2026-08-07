import { movieClient } from '../providers/peerClients.js';
import { askOpenRouter } from '../providers/openRouterProvider.js';
import { searchHistoryRepository } from '../repositories/searchHistoryRepository.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const searchService = {
  async normal(query, userId) {
    const data = await movieClient.search(query);
    if (userId) {
      await searchHistoryRepository.record(userId, query, { cap: config.limits.searchHistoryCap });
    }
    return { data };
  },

  async ai(query, userId) {
    const prompt = `Find matching movie titles or alternate names for: "${query}". Return titles only, separated by newline.`;
    const text = await askOpenRouter(prompt);
    const raw = text || query;

    const titles =
      raw
        .split('\n')
        .map((line) => line.trim().replace(/^["'-\d.\s]*/, ''))
        .filter(Boolean)
        .slice(0, config.limits.maxAiResults) || [query];

    const results = [];
    for (const title of titles.slice(0, config.limits.maxAiResults)) {
      try {
        const data = await movieClient.search(title);
        if (data?.Search?.length) results.push({ title, data });
      } catch (err) {
        logger.warn('ai_search_resolve_failed', { title, message: err.message });
      }
    }

    if (userId) {
      await searchHistoryRepository.record(userId, query, { cap: config.limits.searchHistoryCap });
    }

    return { results, raw };
  },
};
