import { Router } from 'express';
import { redisPing } from '../config/redis.js';

const router = Router();

router.get('/live', (_req, res) => {
  res.status(200).json({ success: true, data: { status: 'ok' }, meta: {} });
});

router.get('/ready', async (_req, res) => {
  try {
    await redisPing();
    res.status(200).json({ success: true, data: { status: 'ready' }, meta: {} });
  } catch {
    res.status(503).json({ success: false, error: { code: 'NOT_READY', message: 'Dependency unavailable' }, requestId: null });
  }
});

export default router;
