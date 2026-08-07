import { ApiError } from '../utils/ApiError.js';
import { config } from '../config/env.js';
import { csrfService } from '../services/csrfService.js';
import { refreshTokenRepository } from '../repositories/refreshTokenRepository.js';
import { hashRefreshToken } from '../utils/tokens.js';

/**
 * Validates the refresh cookie and attaches `req.refreshSession` containing the
 * session id and stored token. Used by cookie-authenticated routes.
 */
export async function requireRefreshCookie(req, _res, next) {
  try {
    const rawToken = req.cookies?.[config.cookie.name];
    if (!rawToken) {
      throw new ApiError(401, 'NO_REFRESH_COOKIE', 'Authentication required');
    }
    const stored = await refreshTokenRepository.findByHash(hashRefreshToken(rawToken));
    if (!stored || stored.revokedAt || stored.rotatedAt) {
      throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Session is invalid. Please sign in again.');
    }
    req.refreshSession = {
      rawToken,
      sid: String(stored.sessionId),
      stored,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/** Verifies the X-CSRF-Token header against the session bound to the refresh cookie. */
export function requireCsrfCookie() {
  return function requireCsrfCookieMiddleware(req, _res, next) {
    const csrf = req.headers['x-csrf-token'];
    if (!req.refreshSession || !csrfService.verify(csrf, req.refreshSession.sid)) {
      return next(new ApiError(403, 'CSRF_INVALID', 'Invalid or missing CSRF token'));
    }
    return next();
  };
}

/** Verifies the X-CSRF-Token header against the access token's sid claim. */
export function requireCsrfBearer() {
  return function requireCsrfBearerMiddleware(req, _res, next) {
    const sid = req.auth?.claims?.sid;
    const csrf = req.headers['x-csrf-token'];
    if (!csrfService.verify(csrf, sid)) {
      return next(new ApiError(403, 'CSRF_INVALID', 'Invalid or missing CSRF token'));
    }
    return next();
  };
}

/** Combines cookie lookup + CSRF validation in one step. */
export function requireCookieAuth() {
  return [requireRefreshCookie, requireCsrfCookie()];
}

/** Applies requireRefreshCookie only when no Bearer auth was attached. */
export function requireRefreshCookieIfAnonymous(req, res, next) {
  if (req.auth) return next();
  return requireRefreshCookie(req, res, next);
}
