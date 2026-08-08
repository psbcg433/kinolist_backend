import { playlistService } from '../services/playlistService.js';
import { ApiError } from '../utils/ApiError.js';
import { validateLegacyCreate, validateLegacyItem, normalizeLegacyType } from '../validators/playlist.validator.js';
import { sendSuccess } from '../utils/response.js';

export const legacyPlaylistController = {
  async create(req, res, next) {
    try {
      const { type, title } = validateLegacyCreate(req.body);
      const playlist = await playlistService.createLegacy(req.auth.userId, { type, title });
      sendSuccess(req, res, { playlist }, { status: 201 });
    } catch (err) {
      next(err);
    }
  },

  async getByUserAndType(req, res, next) {
    try {
      if (req.params.userId !== req.auth.userId) {
        throw new ApiError(403, 'FORBIDDEN', 'You cannot view another user\u2019s playlists');
      }
      const type = normalizeLegacyType(req.params.type);
      const playlist = await playlistService.getLegacyByUserAndType(
        req.auth.userId,
        type,
        req.query.name
      );
      sendSuccess(req, res, { playlist });
    } catch (err) {
      next(err);
    }
  },

  async addMovie(req, res, next) {
    try {
      const item = validateLegacyItem(req.body);
      const playlist = await playlistService.addItem(req.auth.userId, req.params.playlistId, item);
      sendSuccess(req, res, { playlist });
    } catch (err) {
      next(err);
    }
  },

  async removeMovie(req, res, next) {
    try {
      const imdbID = req.body?.imdbID;
      if (typeof imdbID !== 'string' || !/^tt\d{7,10}$/.test(imdbID)) {
        throw new ApiError(400, 'VALIDATION_FAILED', 'A valid imdbID is required');
      }
      const playlist = await playlistService.removeItem(req.auth.userId, req.params.playlistId, imdbID);
      sendSuccess(req, res, { playlist });
    } catch (err) {
      next(err);
    }
  },

  async deletePlaylist(req, res, next) {
    try {
      await playlistService.deleteOwned(req.auth.userId, req.params.playlistId);
      sendSuccess(req, res, { deleted: true, playlistId: req.params.playlistId });
    } catch (err) {
      next(err);
    }
  },
};
