import { movieService } from '../services/movieService.js';
import { validateImdbID, validateBatchIds, validateCatalogQuery, validateSearchQuery } from '../validators/movie.validator.js';
import { movieCardDTO, movieDetailDTO, movieSearchDTO } from '../utils/movieDto.js';
import { sendSuccess } from '../utils/response.js';

export const internalController = {
  async catalog(req, res, next) {
    try {
      const options = validateCatalogQuery(req.query);
      const movies = (await movieService.catalog(options)).map(movieCardDTO).filter(Boolean);
      sendSuccess(req, res, { movies }, { meta: { total: movies.length } });
    } catch (err) {
      next(err);
    }
  },

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
      const { query, type, year, page } = validateSearchQuery(req.query);
      const result = movieSearchDTO(
        await movieService.search(query, { type, year, page }),
        { page }
      );
      const { movies, ...meta } = result;
      sendSuccess(req, res, { movies }, { meta });
    } catch (err) {
      next(err);
    }
  },
};
