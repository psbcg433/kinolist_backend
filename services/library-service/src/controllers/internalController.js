import { playlistService } from '../services/playlistService.js';
import { sendSuccess } from '../utils/response.js';

export const internalController = {
  async itemsForUser(req, res, next) {
    try {
      const types = String(req.query.types || 'favourites,watchlist')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const itemsByType = await playlistService.itemsForUser(req.params.userId, types);
      sendSuccess(req, res, { itemsByType });
    } catch (err) {
      next(err);
    }
  },
};
