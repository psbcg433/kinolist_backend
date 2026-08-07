import Playlist from '../models/playlist.model.js';

export const playlistRepository = {
  async listForUser(userId) {
    return Playlist.find({ userId }).sort({ isSystem: -1, createdAt: 1 }).lean();
  },

  async findByIdAndOwner(playlistId, userId) {
    return Playlist.findOne({ _id: playlistId, userId }).lean();
  },

  async findSystem(userId, type) {
    return Playlist.findOne({ userId, type, isSystem: true }).lean();
  },

  async ensureSystem(userId, type, name) {
    return Playlist.findOneAndUpdate(
      { userId, type, isSystem: true },
      { $setOnInsert: { userId, type, name, isSystem: true, items: [] } },
      { upsert: true, new: true }
    );
  },

  async findCustomByName(userId, name) {
    return Playlist.findOne({ userId, type: 'custom', name }).lean();
  },

  async createCustom(userId, { name, description }) {
    const playlist = await Playlist.create({ userId, type: 'custom', name, description, isSystem: false, items: [] });
    return playlist.toObject();
  },

  async updateCustom(playlistId, userId, fields) {
    return Playlist.findOneAndUpdate({ _id: playlistId, userId, isSystem: false }, { $set: fields }, { new: true }).lean();
  },

  async deleteOwned(playlistId, userId) {
    return Playlist.findOneAndDelete({ _id: playlistId, userId });
  },

  /** Adds an item only if the imdbID is absent; otherwise refreshes its snapshot. */
  async upsertItem(playlistId, userId, item) {
    const updated = await Playlist.findOneAndUpdate(
      { _id: playlistId, userId, 'items.imdbID': { $ne: item.imdbID } },
      { $push: { items: item } },
      { new: true }
    );
    if (updated) return updated.toObject();

    return Playlist.findOneAndUpdate(
      { _id: playlistId, userId, 'items.imdbID': item.imdbID },
      { $set: { 'items.$.title': item.title, 'items.$.posterUrl': item.posterUrl } },
      { new: true }
    ).lean();
  },

  async removeItem(playlistId, userId, imdbID) {
    return Playlist.findOneAndUpdate({ _id: playlistId, userId }, { $pull: { items: { imdbID } } }, { new: true }).lean();
  },

  async itemsForUser(userId, types) {
    const playlists = await Playlist.find({ userId, type: { $in: types } })
      .select('type items')
      .lean();
    return playlists;
  },

  async deleteAllForUser(userId) {
    return Playlist.deleteMany({ userId });
  },
};
