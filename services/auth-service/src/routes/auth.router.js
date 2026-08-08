import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { sessionController } from '../controllers/sessionController.js';
import { twoFactorController } from '../controllers/twoFactorController.js';
import { requireAuth, requireAuthIfPresent } from '../middleware/requireAuth.js';
import {
  requireRefreshCookie,
  requireRefreshCookieIfAnonymous,
  requireCsrfCookieIfAnonymous,
  requireCsrfCookie,
  requireCsrfBearer,
} from '../middleware/requireCsrf.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { config } from '../config/env.js';

const router = Router();

// Public, rate limited
router.post(
  '/register',
  rateLimit({ namespace: 'register', max: config.rateLimit.registerMax }),
  authController.register
);
router.post('/login', rateLimit({ namespace: 'login', max: config.rateLimit.loginMax }), authController.login);
router.post(
  '/2fa/login/verify',
  rateLimit({ namespace: '2fa', max: config.rateLimit.twoFAMax }),
  authController.twoFactorLoginVerify
);

// CSRF bootstrap / recovery: cookie present, no CSRF header required
router.get('/csrf', requireRefreshCookie, authController.csrf);

// Refresh: cookie + CSRF, rate limited
router.post(
  '/refresh',
  rateLimit({ namespace: 'refresh', max: config.rateLimit.refreshMax }),
  requireRefreshCookie,
  requireCsrfCookie(),
  authController.refresh
);

// Authenticated identity
router.get('/me', requireAuth, authController.me);

// Delete account (self-service, password confirmed). Revokes every session and
// emits USER_DELETED.v1 so dependent services can clean up their data.
router.delete(
  '/account',
  rateLimit({ namespace: 'delete_account', max: config.rateLimit.deleteAccountMax }),
  requireAuth,
  requireCsrfBearer(),
  authController.deleteAccount
);

// Logout accepts either a Bearer access token or a cookie session + CSRF
router.post(
  '/logout',
  requireAuthIfPresent,
  requireRefreshCookieIfAnonymous,
  requireCsrfCookieIfAnonymous,
  authController.logout
);

// Logout everywhere: Bearer + CSRF
router.post('/logout-all', requireAuth, requireCsrfBearer(), authController.logoutAll);

// Session management
router.get('/sessions', requireAuth, sessionController.list);
router.delete('/sessions/:sessionId', requireAuth, sessionController.revoke);

// 2FA lifecycle (authenticated)
router.post(
  '/2fa/setup',
  rateLimit({ namespace: '2fa', max: config.rateLimit.twoFAMax }),
  requireAuth,
  twoFactorController.setup
);
router.post(
  '/2fa/setup/verify',
  rateLimit({ namespace: '2fa', max: config.rateLimit.twoFAMax }),
  requireAuth,
  twoFactorController.setupVerify
);
router.post(
  '/2fa/reset',
  rateLimit({ namespace: '2fa', max: config.rateLimit.twoFAMax }),
  requireAuth,
  twoFactorController.reset
);

// Legacy alias: legacy client called POST /api/auth/2fa/verify to activate 2FA
router.post(
  '/2fa/verify',
  rateLimit({ namespace: '2fa', max: config.rateLimit.twoFAMax }),
  requireAuth,
  twoFactorController.legacyVerify
);

export default router;
