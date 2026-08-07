import SearchHistory from '../models/searchHistory.model.js';

export const searchHistoryRepository = {
  async record(userId, query, { cap = 50 } = {}) {
    const entry = { q: query, at: new Date() };
    return SearchHistory.findOneAndUpdate(
      { userId },
      {
        $pull: { queries: { q: query } },
        $push: { queries: { $each: [entry], $slice: -cap } },
        $set: { lastSearched: query, lastSearchedAt: entry.at },
      },
      { upsert: true, new: true }
    ).lean();
  },

  async findByUserId(userId) {
    return SearchHistory.findOne({ userId }).lean();
  },

  async deleteByUserId(userId) {
    return SearchHistory.findOneAndDelete({ userId });
  },
};
