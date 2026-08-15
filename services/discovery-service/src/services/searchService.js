import { movieClient } from '../providers/peerClients.js';
import { askOpenRouter } from '../providers/openRouterProvider.js';
import { searchHistoryRepository } from '../repositories/searchHistoryRepository.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { uniqueMovieSummaries } from '../utils/movieDto.js';

export const searchService = {
  async normal({ query, type, year, page, preview }, userId) {
    const result = await movieClient.search(query, { type, year, page });
    if (userId && !preview) {
      await searchHistoryRepository.record(userId, query, { cap: config.limits.searchHistoryCap });
    }
    return result;
  },

  async ai({ query, type, preview, limit }, userId) {
    const resultLimit = Math.min(limit || config.limits.maxAiResults, config.limits.maxAiResults);
    const prompt = `Find matching movie titles or alternate names for: "${query}". Return titles only, separated by newline.`;
    const text = await askOpenRouter(prompt);
    const raw = text || query;

    const parsedTitles = raw
        .split('\n')
        .map((line) => line.trim().replace(/^["'-\d.\s]*/, ''))
        .filter(Boolean)
        .slice(0, resultLimit);
    const titles = parsedTitles.length > 0 ? parsedTitles : [query];

    const movies = [];
    for (const title of titles.slice(0, resultLimit)) {
      try {
        const result = await movieClient.search(title, { type });
        movies.push(...result.movies);
      } catch (err) {
        logger.warn('ai_search_resolve_failed', { title, message: err.message });
      }
    }

    if (userId && !preview) {
      await searchHistoryRepository.record(userId, query, { cap: config.limits.searchHistoryCap });
    }

    const uniqueMovies = uniqueMovieSummaries(movies, resultLimit);
    return { movies: uniqueMovies, total: uniqueMovies.length };
  },
};
