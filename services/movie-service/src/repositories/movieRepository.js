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
};
