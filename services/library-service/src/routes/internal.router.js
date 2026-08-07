import { Router } from 'express';
import { requireInternal } from '../middleware/auth.middleware.js';
import { internalController } from '../controllers/internalController.js';

const router = Router();

router.use(requireInternal);

router.get('/library/:userId/items', internalController.itemsForUser);

export default router;
