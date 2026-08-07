import { playlistService } from '../services/playlistService.js';
import { validateCreate, validateUpdate, validateItem } from '../validators/playlist.validator.js';

export const libraryController = {
  async list(req, res, next) {
    try {
      const playlists = await playlistService.listForUser(req.auth.userId);
      res.json({ success: true, data: { playlists } });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const playlist = await playlistService.getForUser(req.auth.userId, req.params.playlistId);
      res.json({ success: true, data: { playlist } });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const fields = validateCreate(req.body);
      const playlist = await playlistService.createCustom(req.auth.userId, fields);
      res.status(201).json({ success: true, data: { playlist } });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const fields = validateUpdate(req.body);
      const playlist = await playlistService.updateCustom(req.auth.userId, req.params.playlistId, fields);
      res.json({ success: true, data: { playlist } });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      await playlistService.deleteOwned(req.auth.userId, req.params.playlistId);
      res.json({ success: true, data: { deleted: true, id: req.params.playlistId } });
    } catch (err) {
      next(err);
    }
  },

  async addItem(req, res, next) {
    try {
      const item = validateItem(req.body);
      const playlist = await playlistService.addItem(req.auth.userId, req.params.playlistId, item);
      res.json({ success: true, data: { playlist } });
    } catch (err) {
      next(err);
    }
  },

  async removeItem(req, res, next) {
    try {
      const playlist = await playlistService.removeItem(req.auth.userId, req.params.playlistId, req.params.imdbID);
      res.json({ success: true, data: { playlist } });
    } catch (err) {
      next(err);
    }
  },

  async getFavourites(req, res, next) {
    try {
      const playlist = await playlistService.getSystem(req.auth.userId, 'favourites');
      res.json({ success: true, data: { playlist } });
    } catch (err) {
      next(err);
    }
  },

  async getWatchlist(req, res, next) {
    try {
      const playlist = await playlistService.getSystem(req.auth.userId, 'watchlist');
      res.json({ success: true, data: { playlist } });
    } catch (err) {
      next(err);
    }
  },

  async getSummary(req, res, next) {
    try {
      const summary = await playlistService.summary(req.auth.userId);
      res.json({ success: true, data: { summary } });
    } catch (err) {
      next(err);
    }
  },
};
