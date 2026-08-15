import { searchService } from '../services/searchService.js';
import { validateSearchQuery } from '../validators/discovery.validator.js';
import { sendSuccess } from '../utils/response.js';

function sendMovieResult(req, res, result) {
  const { movies = [], ...meta } = result;
  return sendSuccess(req, res, { movies }, { meta });
}

export const searchController = {
  async normal(req, res, next) {
    try {
      const search = validateSearchQuery(req.query);
      const userId = req.auth?.userId || null;
      const result = await searchService.normal(search, userId);
      sendMovieResult(req, res, result);
    } catch (err) {
      next(err);
    }
  },

  async ai(req, res, next) {
    try {
      const search = validateSearchQuery(req.query);
      const userId = req.auth?.userId || null;
      const result = await searchService.ai(search, userId);
      sendMovieResult(req, res, result);
    } catch (err) {
      next(err);
    }
  },
};
