import { searchService } from '../services/searchService.js';
import { validateSearchQuery } from '../validators/discovery.validator.js';

export const searchController = {
  async normal(req, res, next) {
    try {
      const query = validateSearchQuery(req.query);
      const userId = req.auth?.userId || null;
      const result = await searchService.normal(query, userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async ai(req, res, next) {
    try {
      const query = validateSearchQuery(req.query);
      const userId = req.auth?.userId || null;
      const result = await searchService.ai(query, userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
