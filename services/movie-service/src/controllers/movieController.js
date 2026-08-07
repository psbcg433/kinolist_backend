import { movieService } from '../services/movieService.js';
import { validateImdbID } from '../validators/movie.validator.js';

export const movieController = {
  async getById(req, res, next) {
    try {
      const imdbID = validateImdbID(req.params.imdbID);
      const data = await movieService.getById(imdbID);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
};
