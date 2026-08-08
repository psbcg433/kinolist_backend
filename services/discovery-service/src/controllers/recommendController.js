import { recommendService } from '../services/recommendService.js';
import { validateUserId } from '../validators/discovery.validator.js';
import { sendSuccess } from '../utils/response.js';

export const recommendController = {
  async fromLastSearch(req, res, next) {
    try {
      validateUserId(req.params.userId, req.auth.userId);
      const result = await recommendService.fromLastSearch(req.auth.userId);
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  },

  async fromSearchHistory(req, res, next) {
    try {
      validateUserId(req.params.userId, req.auth.userId);
      const result = await recommendService.fromSearchHistory(req.auth.userId);
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  },

  async fromFavourites(req, res, next) {
    try {
      validateUserId(req.params.userId, req.auth.userId);
      const result = await recommendService.fromPlaylist(req.auth.userId, 'favourites');
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  },

  async fromWatchlist(req, res, next) {
    try {
      validateUserId(req.params.userId, req.auth.userId);
      const result = await recommendService.fromPlaylist(req.auth.userId, 'watchlist');
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  },
};
