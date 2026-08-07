import { playlistService } from '../services/playlistService.js';

export const internalController = {
  async itemsForUser(req, res, next) {
    try {
      const types = String(req.query.types || 'favourites,watchlist')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const items = await playlistService.itemsForUser(req.params.userId, types);
      res.json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  },
};
