import { playlistService } from '../services/playlistService.js';
import { ApiError } from '../utils/ApiError.js';
import { validateLegacyCreate, validateLegacyItem, normalizeLegacyType } from '../validators/playlist.validator.js';

export const legacyPlaylistController = {
  async create(req, res, next) {
    try {
      const { type, title } = validateLegacyCreate(req.body);
      const playlist = await playlistService.createLegacy(req.auth.userId, { type, title });
      res.status(201).json({ playlist });
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
      const playlist = await playlistService.getLegacyByUserAndType(req.auth.userId, type);
      res.json({ playlist });
    } catch (err) {
      next(err);
    }
  },

  async addMovie(req, res, next) {
    try {
      const item = validateLegacyItem(req.body);
      const playlist = await playlistService.addItem(req.auth.userId, req.params.playlistId, item);
      res.json({ playlist: legacyShape(playlist) });
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
      res.json({ playlist: legacyShape(playlist) });
    } catch (err) {
      next(err);
    }
  },

  async deletePlaylist(req, res, next) {
    try {
      await playlistService.deleteOwned(req.auth.userId, req.params.playlistId);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
};

function legacyShape(playlist) {
  return {
    _id: playlist.id,
    userId: playlist.userId,
    type: playlist.type,
    title: playlist.name,
    isSystem: playlist.isSystem,
    movies: playlist.items || [],
  };
}
