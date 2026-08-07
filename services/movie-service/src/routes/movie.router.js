import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { movieController } from '../controllers/movieController.js';

const router = Router();

router.get('/:imdbID', requireAuth, movieController.getById);

export default router;
