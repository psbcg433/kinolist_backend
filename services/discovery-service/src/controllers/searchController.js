import { searchService } from '../services/searchService.js';
import { validateSearchQuery } from '../validators/discovery.validator.js';
import { sendSuccess } from '../utils/response.js';

function sendMovieResult(req, res, result) {
  return sendSuccess(req, res, { movies: result.movies || [] }, { meta: { total: result.total || 0 } });
}

export const searchController = {
  async normal(req, res, next) {
    try {
      const query = validateSearchQuery(req.query);
      const userId = req.auth?.userId || null;
      const result = await searchService.normal(query, userId);
      sendMovieResult(req, res, result);
    } catch (err) {
      next(err);
    }
  },

  async ai(req, res, next) {
    try {
      const query = validateSearchQuery(req.query);
      const userId = req.auth?.userId || null;
      const result = await searchService.ai(query, userId);
      sendMovieResult(req, res, result);
    } catch (err) {
      next(err);
    }
  },
};
