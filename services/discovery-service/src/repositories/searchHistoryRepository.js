import SearchHistory from '../models/searchHistory.model.js';

export const searchHistoryRepository = {
  async record(userId, query, { cap = 50 } = {}) {
    const entry = { q: query, at: new Date() };
    return SearchHistory.findOneAndUpdate(
      { userId },
      [
        {
          $set: {
            userId,
            queries: {
              $slice: [
                {
                  $concatArrays: [
                    {
                      $filter: {
                        input: { $ifNull: ['$queries', []] },
                        as: 'existing',
                        cond: { $ne: ['$$existing.q', query] },
                      },
                    },
                    [entry],
                  ],
                },
                -cap,
              ],
            },
            lastSearched: query,
            lastSearchedAt: entry.at,
          },
        },
      ],
      { upsert: true, new: true }
    ).lean();
  },

  async findByUserId(userId) {
    return SearchHistory.findOne({ userId }).lean();
  },

  async popularQueries({ since, limit = 8 } = {}) {
    const rows = await SearchHistory.aggregate([
      { $unwind: '$queries' },
      ...(since ? [{ $match: { 'queries.at': { $gte: since } } }] : []),
      {
        $group: {
          _id: { $toLower: '$queries.q' },
          count: { $sum: 1 },
          lastSearchedAt: { $max: '$queries.at' },
        },
      },
      { $sort: { count: -1, lastSearchedAt: -1 } },
      { $limit: limit },
      { $project: { _id: 0, query: '$_id', count: 1, lastSearchedAt: 1 } },
    ]);
    return rows;
  },

  async deleteByUserId(userId) {
    return SearchHistory.findOneAndDelete({ userId });
  },
};
