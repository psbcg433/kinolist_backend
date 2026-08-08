import { movieClient } from '../providers/peerClients.js';
import { askOpenRouter } from '../providers/openRouterProvider.js';
import { searchHistoryRepository } from '../repositories/searchHistoryRepository.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { uniqueMovieSummaries } from '../utils/movieDto.js';

export const searchService = {
  async normal(query, userId) {
    const result = await movieClient.search(query);
    if (userId) {
      await searchHistoryRepository.record(userId, query, { cap: config.limits.searchHistoryCap });
    }
    return result;
  },

  async ai(query, userId) {
    const prompt = `Find matching movie titles or alternate names for: "${query}". Return titles only, separated by newline.`;
    const text = await askOpenRouter(prompt);
    const raw = text || query;

    const parsedTitles = raw
        .split('\n')
        .map((line) => line.trim().replace(/^["'-\d.\s]*/, ''))
        .filter(Boolean)
        .slice(0, config.limits.maxAiResults);
    const titles = parsedTitles.length > 0 ? parsedTitles : [query];

    const movies = [];
    for (const title of titles.slice(0, config.limits.maxAiResults)) {
      try {
        const result = await movieClient.search(title);
        movies.push(...result.movies);
      } catch (err) {
        logger.warn('ai_search_resolve_failed', { title, message: err.message });
      }
    }

    if (userId) {
      await searchHistoryRepository.record(userId, query, { cap: config.limits.searchHistoryCap });
    }

    const uniqueMovies = uniqueMovieSummaries(movies, config.limits.maxAiResults);
    return { movies: uniqueMovies, total: uniqueMovies.length };
  },
};
