import { feedService } from '../services/feedService.js';
import { validateGenre } from '../validators/discovery.validator.js';

export const feedController = {
  async trending(req, res, next) {
    try {
      const data = await feedService.trending();
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },

  async byGenre(req, res, next) {
    try {
      const genre = validateGenre(req.params.genre);
      const data = await feedService.byGenre(genre);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },

  async ongoing(req, res, next) {
    try {
      const data = await feedService.ongoing();
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },

  async discover(req, res, next) {
    try {
      const result = await feedService.discover();
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
