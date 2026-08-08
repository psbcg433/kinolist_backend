import { movieService } from '../services/movieService.js';
import { validateImdbID, validateBatchIds, validateSearchQuery } from '../validators/movie.validator.js';
import { movieDetailDTO, movieSearchDTO } from '../utils/movieDto.js';
import { sendSuccess } from '../utils/response.js';

export const internalController = {
  async getById(req, res, next) {
    try {
      const imdbID = validateImdbID(req.params.imdbID);
      const movie = movieDetailDTO(await movieService.getById(imdbID));
      sendSuccess(req, res, { movie });
    } catch (err) {
      next(err);
    }
  },

  async batch(req, res, next) {
    try {
      const ids = validateBatchIds(req.body);
      const rawMovies = await movieService.batch(ids);
      const moviesById = Object.fromEntries(
        Object.entries(rawMovies).map(([id, movie]) => [id, movieDetailDTO(movie)])
      );
      sendSuccess(req, res, { moviesById });
    } catch (err) {
      next(err);
    }
  },

  async search(req, res, next) {
    try {
      const { query, type, year } = validateSearchQuery(req.query);
      const { movies, total } = movieSearchDTO(await movieService.search(query, { type, year }));
      sendSuccess(req, res, { movies }, { meta: { total } });
    } catch (err) {
      next(err);
    }
  },
};
