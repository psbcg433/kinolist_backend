import { Router } from 'express';
import { requireAuth, requireAuthIfPresent } from '../middleware/auth.middleware.js';
import { aiRateLimit } from '../middleware/aiRateLimit.js';
import { searchController } from '../controllers/searchController.js';

const router = Router();

router.get('/', requireAuthIfPresent, searchController.normal);
router.get('/ai', requireAuth, aiRateLimit(), searchController.ai);

export default router;
