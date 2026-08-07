import { movieService } from '../services/movieService.js';
import { validateImdbID, validateBatchIds, validateSearchQuery } from '../validators/movie.validator.js';

export const internalController = {
  async getById(req, res, next) {
    try {
      const imdbID = validateImdbID(req.params.imdbID);
      const data = await movieService.getById(imdbID);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async batch(req, res, next) {
    try {
      const ids = validateBatchIds(req.body);
      const data = await movieService.batch(ids);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async search(req, res, next) {
    try {
      const { query, type, year } = validateSearchQuery(req.query);
      const data = await movieService.search(query, { type, year });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
