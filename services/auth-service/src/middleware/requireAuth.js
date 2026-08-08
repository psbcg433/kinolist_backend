import { ApiError } from '../utils/ApiError.js';
import { jwtService } from '../services/jwtService.js';
import { tokenBlacklist } from '../services/tokenBlacklist.js';
import { userRepository } from '../repositories/userRepository.js';

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Access token is required');
    }
    const token = header.slice(7).trim();
    const claims = jwtService.verifyAccessToken(token);

    let currentTv;
    try {
      if (await tokenBlacklist.isJtiRevoked(claims.jti)) {
        throw new ApiError(401, 'TOKEN_REVOKED', 'Access token has been revoked');
      }
      if (await tokenBlacklist.isSessionRevoked(claims.sid)) {
        throw new ApiError(401, 'SESSION_REVOKED', 'Your session has been revoked');
      }
      currentTv = await tokenBlacklist.getTokenVersion(claims.sub);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(503, 'AUTHORIZATION_UNAVAILABLE', 'Authorization state is temporarily unavailable');
    }
    if (currentTv !== null && currentTv !== claims.tokenVersion) {
      throw new ApiError(401, 'TOKEN_VERSION_CHANGED', 'Your session has been invalidated');
    }

    const user = await userRepository.findById(claims.sub);
    if (!user || user.status !== 'active') {
      throw new ApiError(401, 'ACCOUNT_UNAVAILABLE', 'This account is no longer available');
    }
    if (user.tokenVersion !== claims.tokenVersion) {
      throw new ApiError(401, 'TOKEN_VERSION_CHANGED', 'Your session has been invalidated');
    }

    req.auth = { token, claims, user };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Applies requireAuth when a Bearer token is present, otherwise continues
 * anonymously. Used by the logout route which also accepts cookie sessions.
 */
export async function requireAuthIfPresent(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  return requireAuth(req, _res, next);
}
