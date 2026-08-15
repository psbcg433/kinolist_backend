import Movie from '../models/movie.model.js';

export const movieRepository = {
  async findByImdbID(imdbID) {
    return Movie.findOne({ imdbID }).lean();
  },

  async upsert(imdbID, data) {
    return Movie.findOneAndUpdate(
      { imdbID },
      { $set: { data, fetchedAt: new Date() } },
      { upsert: true, new: true }
    );
  },

  async listCached(limit = 250) {
    return Movie.find({ data: { $ne: null } })
      .select('data fetchedAt')
      .sort({ fetchedAt: -1 })
      .limit(limit)
      .lean();
  },
};
