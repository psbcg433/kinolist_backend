import { playlistService } from '../services/playlistService.js';
import { validateCreate, validateUpdate, validateItem } from '../validators/playlist.validator.js';
import { sendSuccess } from '../utils/response.js';

export const libraryController = {
  async list(req, res, next) {
    try {
      const playlists = await playlistService.listForUser(req.auth.userId);
      sendSuccess(req, res, { playlists });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const playlist = await playlistService.getForUser(req.auth.userId, req.params.playlistId);
      sendSuccess(req, res, { playlist });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const fields = validateCreate(req.body);
      const playlist = await playlistService.createCustom(req.auth.userId, fields);
      sendSuccess(req, res, { playlist }, { status: 201 });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const fields = validateUpdate(req.body);
      const playlist = await playlistService.updateCustom(req.auth.userId, req.params.playlistId, fields);
      sendSuccess(req, res, { playlist });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      await playlistService.deleteOwned(req.auth.userId, req.params.playlistId);
      sendSuccess(req, res, { deleted: true, playlistId: req.params.playlistId });
    } catch (err) {
      next(err);
    }
  },

  async addItem(req, res, next) {
    try {
      const item = validateItem(req.body);
      const playlist = await playlistService.addItem(req.auth.userId, req.params.playlistId, item);
      sendSuccess(req, res, { playlist });
    } catch (err) {
      next(err);
    }
  },

  async removeItem(req, res, next) {
    try {
      const playlist = await playlistService.removeItem(req.auth.userId, req.params.playlistId, req.params.imdbID);
      sendSuccess(req, res, { playlist });
    } catch (err) {
      next(err);
    }
  },

  async getFavourites(req, res, next) {
    try {
      const playlist = await playlistService.getSystem(req.auth.userId, 'favourites');
      sendSuccess(req, res, { playlist });
    } catch (err) {
      next(err);
    }
  },

  async getWatchlist(req, res, next) {
    try {
      const playlist = await playlistService.getSystem(req.auth.userId, 'watchlist');
      sendSuccess(req, res, { playlist });
    } catch (err) {
      next(err);
    }
  },

  async getSummary(req, res, next) {
    try {
      const summary = await playlistService.summary(req.auth.userId);
      sendSuccess(req, res, { summary });
    } catch (err) {
      next(err);
    }
  },
};
