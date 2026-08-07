import { playlistRepository } from '../repositories/playlistRepository.js';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const SYSTEM_TYPES = new Set(['favourites', 'watchlist']);
const SYSTEM_NAMES = { favourites: 'Favourites', watchlist: 'Watchlist' };

function itemDTO(item) {
  return { imdbID: item.imdbID, title: item.title || '', posterUrl: item.posterUrl || '' };
}

export function playlistDTO(playlist, { includeItems = true } = {}) {
  if (!playlist) return null;
  const items = Array.isArray(playlist.items) ? playlist.items : [];
  return {
    id: String(playlist._id),
    userId: playlist.userId,
    type: playlist.type,
    name: playlist.name || '',
    description: playlist.description || '',
    isSystem: Boolean(playlist.isSystem),
    itemCount: items.length,
    items: includeItems ? items.map(itemDTO) : undefined,
  };
}

export function legacyPlaylistDTO(playlist) {
  if (!playlist) return null;
  const items = Array.isArray(playlist.items) ? playlist.items : [];
  return {
    _id: String(playlist._id),
    userId: playlist.userId,
    type: playlist.type,
    title: playlist.name || '',
    isSystem: Boolean(playlist.isSystem),
    movies: items.map(itemDTO),
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const playlistService = {
  async listForUser(userId) {
    const playlists = await playlistRepository.listForUser(userId);
    return playlists.map((p) => playlistDTO(p, { includeItems: false }));
  },

  async ensureSystem(userId, type) {
    try {
      const playlist = await playlistRepository.ensureSystem(userId, type, SYSTEM_NAMES[type]);
      return playlistDTO(playlist.toObject ? playlist.toObject() : playlist);
    } catch (err) {
      if (err.code === 11000) {
        const existing = await playlistRepository.findSystem(userId, type);
        if (existing) return playlistDTO(existing);
      }
      throw err;
    }
  },

  async getForUser(userId, playlistId) {
    const playlist = await playlistRepository.findByIdAndOwner(playlistId, userId);
    if (!playlist) throw new ApiError(404, 'PLAYLIST_NOT_FOUND', 'Playlist not found');
    return playlistDTO(playlist);
  },

  async getSystem(userId, type) {
    await this.ensureSystem(userId, type);
    return this.getForUser(userId, (await playlistRepository.findSystem(userId, type))._id);
  },

  async getLegacyByUserAndType(userId, type) {
    if (SYSTEM_TYPES.has(type)) {
      await this.ensureSystem(userId, type);
      const playlist = await playlistRepository.findSystem(userId, type);
      return legacyPlaylistDTO(playlist);
    }
    const playlist = await playlistRepository.findCustomByName(userId, type);
    if (!playlist) throw new ApiError(404, 'PLAYLIST_NOT_FOUND', 'Playlist not found');
    return legacyPlaylistDTO(playlist);
  },

  async createCustom(userId, { name, description }) {
    await this.assertCustomNameAvailable(userId, name);
    let playlist;
    try {
      playlist = await playlistRepository.createCustom(userId, { name, description });
    } catch (err) {
      if (err.code === 11000) {
        throw new ApiError(409, 'PLAYLIST_NAME_EXISTS', 'A playlist with this name already exists');
      }
      throw err;
    }
    logger.info('playlist_created', { playlistId: playlist._id, userId });
    return playlistDTO(playlist);
  },

  async createLegacy(userId, { type, title }) {
    if (SYSTEM_TYPES.has(type)) {
      const playlist = await this.ensureSystem(userId, type);
      return legacyPlaylistDTO({ ...playlist, _id: playlist.id });
    }
    const existing = await playlistRepository.findCustomByName(userId, title);
    if (existing) return legacyPlaylistDTO(existing);
    const playlist = await this.createCustom(userId, { name: title, description: '' });
    return legacyPlaylistDTO({ ...playlist, _id: playlist.id });
  },

  async updateCustom(userId, playlistId, { name, description }) {
    const current = await playlistRepository.findByIdAndOwner(playlistId, userId);
    if (!current) throw new ApiError(404, 'PLAYLIST_NOT_FOUND', 'Playlist not found');
    if (current.isSystem) {
      throw new ApiError(400, 'SYSTEM_PLAYLIST_IMMUTABLE', 'System playlists cannot be renamed');
    }
    if (name !== undefined) await this.assertCustomNameAvailable(userId, name, playlistId);
    const playlist = await playlistRepository.updateCustom(playlistId, userId, { name, description });
    return playlistDTO(playlist);
  },

  async assertCustomNameAvailable(userId, name, excludeId) {
    const existing = await playlistRepository.findCustomByName(userId, {
      $regex: new RegExp(`^${escapeRegExp(name)}$`, 'i'),
    });
    if (existing && String(existing._id) !== String(excludeId)) {
      throw new ApiError(409, 'PLAYLIST_NAME_EXISTS', 'A playlist with this name already exists');
    }
  },

  async deleteOwned(userId, playlistId) {
    const current = await playlistRepository.findByIdAndOwner(playlistId, userId);
    if (!current) throw new ApiError(404, 'PLAYLIST_NOT_FOUND', 'Playlist not found');
    if (current.isSystem) {
      throw new ApiError(400, 'SYSTEM_PLAYLIST_IMMUTABLE', 'System playlists cannot be deleted');
    }
    await playlistRepository.deleteOwned(playlistId, userId);
    logger.info('playlist_deleted', { playlistId, userId });
    return true;
  },

  async addItem(userId, playlistId, item) {
    const current = await playlistRepository.findByIdAndOwner(playlistId, userId);
    if (!current) throw new ApiError(404, 'PLAYLIST_NOT_FOUND', 'Playlist not found');

    const alreadyPresent = (current.items || []).some((i) => i.imdbID === item.imdbID);
    if (!alreadyPresent && (current.items || []).length >= config.limits.maxItemsPerPlaylist) {
      throw new ApiError(409, 'PLAYLIST_LIMIT_REACHED', 'This playlist has reached its item limit');
    }

    const playlist = await playlistRepository.upsertItem(playlistId, userId, item);
    if (!playlist) throw new ApiError(404, 'PLAYLIST_NOT_FOUND', 'Playlist not found');
    return playlistDTO(playlist);
  },

  async removeItem(userId, playlistId, imdbID) {
    const current = await playlistRepository.findByIdAndOwner(playlistId, userId);
    if (!current) throw new ApiError(404, 'PLAYLIST_NOT_FOUND', 'Playlist not found');
    const playlist = await playlistRepository.removeItem(playlistId, userId, imdbID);
    return playlistDTO(playlist);
  },

  async summary(userId) {
    const playlists = await playlistRepository.listForUser(userId);
    const favourites = playlists.find((p) => p.type === 'favourites');
    const watchlist = playlists.find((p) => p.type === 'watchlist');
    const custom = playlists.filter((p) => p.type === 'custom');
    return {
      favouritesCount: favourites?.items?.length ?? 0,
      watchlistCount: watchlist?.items?.length ?? 0,
      customPlaylists: custom.map((p) => ({
        id: String(p._id),
        name: p.name,
        itemCount: p.items?.length ?? 0,
      })),
    };
  },

  async itemsForUser(userId, types = ['favourites', 'watchlist']) {
    const safeTypes = types.filter((t) => SYSTEM_TYPES.has(t));
    const playlists = await playlistRepository.itemsForUser(userId, safeTypes);
    const result = { favourites: [], watchlist: [] };
    for (const playlist of playlists) {
      result[playlist.type] = (playlist.items || []).map(itemDTO);
    }
    return result;
  },

  async deleteForUser(userId) {
    await playlistRepository.deleteAllForUser(userId);
    logger.info('playlists_deleted_from_event', { userId });
    return true;
  },
};
