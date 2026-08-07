import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { generateRefreshToken, hashRefreshToken } from '../utils/tokens.js';
import { refreshTokenRepository } from '../repositories/refreshTokenRepository.js';
import { sessionRepository } from '../repositories/sessionRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { tokenBlacklist } from './tokenBlacklist.js';
import { authLogRepository } from '../repositories/authLogRepository.js';
import { addDays } from './cookieService.js';

export const refreshTokenService = {
  /**
   * Rotates a refresh token atomically. A token that was already rotated or
   * revoked is treated as reuse, which revokes the whole token family and its
   * session and requires reauthentication.
   */
  async rotate({ rawToken }) {
    const hash = hashRefreshToken(rawToken);
    const stored = await refreshTokenRepository.findByHash(hash);

    if (!stored) {
      throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Session is invalid. Please sign in again.');
    }

    if (stored.revokedAt || stored.rotatedAt) {
      await this.handleReuse(stored);
      throw new ApiError(401, 'REFRESH_TOKEN_REUSE', 'Session was invalidated. Please sign in again.');
    }

    const now = new Date();
    if (stored.expiresAt < now) {
      await refreshTokenRepository.revokeByFamily(stored.familyId, 'expired');
      throw new ApiError(401, 'REFRESH_TOKEN_EXPIRED', 'Your session has expired. Please sign in again.');
    }

    const session = await sessionRepository.findById(stored.sessionId);
    const user = await userRepository.findById(stored.userId);
    if (!session || session.revokedAt || session.expiresAt < now) {
      await refreshTokenRepository.revokeByFamily(stored.familyId, 'session_invalid');
      throw new ApiError(401, 'SESSION_INVALIDATED', 'Your session is no longer valid. Please sign in again.');
    }
    if (!user || user.status !== 'active') {
      await refreshTokenRepository.revokeByFamily(stored.familyId, 'user_inactive');
      throw new ApiError(401, 'ACCOUNT_UNAVAILABLE', 'This account is no longer available.');
    }

    const nextRaw = generateRefreshToken();
    const nextHash = hashRefreshToken(nextRaw);
    const rotated = await refreshTokenRepository.markRotated(stored._id, nextHash);
    if (!rotated) {
      // Another request rotated this token first — replay/race. Revoke family.
      await this.handleReuse(stored);
      throw new ApiError(401, 'REFRESH_TOKEN_REUSE', 'Session was invalidated. Please sign in again.');
    }

    await refreshTokenRepository.create({
      tokenHash: nextHash,
      familyId: stored.familyId,
      sessionId: stored.sessionId,
      userId: stored.userId,
      expiresAt: addDays(new Date(), config.refreshTokenTtlDays),
    });

    await sessionRepository.touch(stored.sessionId);

    return { refreshToken: nextRaw, sessionId: String(stored.sessionId), user };
  },

  async handleReuse(stored) {
    await refreshTokenRepository.revokeByFamily(stored.familyId, 'reuse_detected');
    await sessionRepository.revokeById(stored.sessionId, 'reuse_detected');
    await tokenBlacklist.revokeSession(String(stored.sessionId)).catch(() => {});
    await authLogRepository.record({
      userId: stored.userId,
      event: 'refresh_token_reuse',
      detail: `family=${stored.familyId}`,
    });
  },
};
