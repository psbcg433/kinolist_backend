import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { imageUpload, validateImageBuffers } from '../validators/upload.validator.js';
import { profileController } from '../controllers/profileController.js';

const router = Router();

router.get('/me', requireAuth, profileController.getMe);
router.get('/:id', requireAuth, profileController.getById);
router.put(
  '/update',
  requireAuth,
  imageUpload.fields([
    { name: 'profilePic', maxCount: 1 },
    { name: 'coverPic', maxCount: 1 },
  ]),
  validateImageBuffers,
  profileController.update
);

export default router;
