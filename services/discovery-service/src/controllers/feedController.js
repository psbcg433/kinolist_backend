import { feedService } from '../services/feedService.js';
import { validateGenre } from '../validators/discovery.validator.js';
import { sendSuccess } from '../utils/response.js';

function sendMovieResult(req, res, result) {
  return sendSuccess(req, res, { movies: result.movies || [] }, { meta: { total: result.total || 0 } });
}

export const feedController = {
  async trending(req, res, next) {
    try {
      sendMovieResult(req, res, await feedService.trending());
    } catch (err) {
      next(err);
    }
  },

  async byGenre(req, res, next) {
    try {
      const genre = validateGenre(req.params.genre);
      sendMovieResult(req, res, await feedService.byGenre(genre));
    } catch (err) {
      next(err);
    }
  },

  async ongoing(req, res, next) {
    try {
      sendMovieResult(req, res, await feedService.ongoing());
    } catch (err) {
      next(err);
    }
  },

  async discover(req, res, next) {
    try {
      sendMovieResult(req, res, await feedService.discover());
    } catch (err) {
      next(err);
    }
  },
};
