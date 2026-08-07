import { Router } from 'express';
import { requireAuthIfPresent } from '../middleware/auth.middleware.js';
import { searchController } from '../controllers/searchController.js';

const router = Router();

router.use(requireAuthIfPresent);

router.get('/', searchController.normal);
router.get('/ai', searchController.ai);

export default router;
