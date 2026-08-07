import { Router } from 'express';
import { requireInternal } from '../middleware/auth.middleware.js';
import { internalController } from '../controllers/internalController.js';

const router = Router();

router.use(requireInternal);

router.get('/movie/search', internalController.search);
router.get('/movie/:imdbID', internalController.getById);
router.post('/movie/batch', internalController.batch);

export default router;
