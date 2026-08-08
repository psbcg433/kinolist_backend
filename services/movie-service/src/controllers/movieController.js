import { movieService } from '../services/movieService.js';
import { validateImdbID } from '../validators/movie.validator.js';
import { movieDetailDTO } from '../utils/movieDto.js';
import { sendSuccess } from '../utils/response.js';

export const movieController = {
  async getById(req, res, next) {
    try {
      const imdbID = validateImdbID(req.params.imdbID);
      const movie = movieDetailDTO(await movieService.getById(imdbID));
      sendSuccess(req, res, { movie });
    } catch (err) {
      next(err);
    }
  },
};
