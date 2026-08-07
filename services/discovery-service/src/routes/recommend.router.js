import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { recommendController } from '../controllers/recommendController.js';

const router = Router();

router.use(requireAuth);

router.get('/last-search/:userId', recommendController.fromLastSearch);
router.get('/search-history/:userId', recommendController.fromSearchHistory);
router.get('/favourites/:userId', recommendController.fromFavourites);
router.get('/watchlist/:userId', recommendController.fromWatchlist);

export default router;
