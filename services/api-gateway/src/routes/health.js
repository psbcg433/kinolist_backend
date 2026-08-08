import { Router } from 'express';
import { redisPing } from '../config/redis.js';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';

const router = Router();

router.get('/live', (req, res) => {
  sendSuccess(req, res, { status: 'ok' });
});

router.get('/ready', async (req, res, next) => {
  try {
    await redisPing();
    const timeoutMs = Math.min(config.upstreamTimeoutMs, 3000);
    await Promise.all(
      Object.values(config.serviceUrls).map(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/health/ready`, {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) throw new Error('upstream not ready');
      })
    );
    sendSuccess(req, res, { status: 'ready' });
  } catch {
    next(new ApiError(503, 'NOT_READY', 'Dependency unavailable'));
  }
});

export default router;
