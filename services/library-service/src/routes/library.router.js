import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { libraryController } from '../controllers/libraryController.js';

const router = Router();

router.use(requireAuth);

router.get('/playlists', libraryController.list);
router.post('/playlists', libraryController.create);
router.get('/playlists/:playlistId', libraryController.get);
router.patch('/playlists/:playlistId', libraryController.update);
router.delete('/playlists/:playlistId', libraryController.remove);
router.post('/playlists/:playlistId/items', libraryController.addItem);
router.delete('/playlists/:playlistId/items/:imdbID', libraryController.removeItem);

router.get('/favourites', libraryController.getFavourites);
router.get('/watchlist', libraryController.getWatchlist);
router.get('/summary', libraryController.getSummary);

export default router;
