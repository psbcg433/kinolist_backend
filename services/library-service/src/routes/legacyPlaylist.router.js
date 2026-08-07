import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { legacyPlaylistController } from '../controllers/legacyPlaylistController.js';

const router = Router();

router.use(requireAuth);

router.post('/', legacyPlaylistController.create);
router.get('/:userId/:type', legacyPlaylistController.getByUserAndType);
router.put('/:playlistId/add', legacyPlaylistController.addMovie);
router.put('/:playlistId/remove', legacyPlaylistController.removeMovie);
router.delete('/:playlistId', legacyPlaylistController.deletePlaylist);

export default router;
