import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { feedController } from '../controllers/feedController.js';

const router = Router();

router.use(requireAuth);

router.get('/trending', feedController.trending);
router.get('/genre/:genre', feedController.byGenre);
router.get('/ongoing', feedController.ongoing);
router.get('/discover', feedController.discover);
router.get('/top-rated', feedController.topRated);

export default router;
