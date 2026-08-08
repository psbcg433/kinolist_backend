import bcrypt from 'bcryptjs';
import { ApiError } from '../utils/ApiError.js';
import { userRepository } from '../repositories/userRepository.js';
import { sessionRepository } from '../repositories/sessionRepository.js';
import { refreshTokenRepository } from '../repositories/refreshTokenRepository.js';
import { revokedTokenRepository } from '../repositories/revokedTokenRepository.js';
import { authLogRepository } from '../repositories/authLogRepository.js';
import { passwordService } from './passwordService.js';
import { jwtService } from './jwtService.js';
import { csrfService } from './csrfService.js';
import { sessionService } from './sessionService.js';
import { refreshTokenService } from './refreshTokenService.js';
import { tokenBlacklist } from './tokenBlacklist.js';
import { twoFactorChallengeService } from './twoFactorChallengeService.js';
import { emailService, maskEmail } from './emailService.js';
import { buildUserRegisteredEvent, buildUserDeletedEvent } from '../events/publishers/userEvents.js';
import { addDays } from './cookieService.js';

export function sanitizeUser(user) {
  return {
    id: String(user._id),
    email: user.email,
    role: user.role,
    twoFAEnabled: user.twoFAEnabled,
  };
}

async function deliverTwoFactorChallenge(user, purpose) {
  const challenge = await twoFactorChallengeService.create(user._id, purpose);
  try {
    await emailService.sendTwoFactorChallenge({
      email: user.email,
      code: challenge.code,
      purpose,
      expiresInSeconds: challenge.expiresInSeconds,
    });
  } catch {
    await twoFactorChallengeService.cancel(challenge.challengeId, user._id, purpose).catch(() => {});
    throw new ApiError(
      503,
      'TWO_FACTOR_DELIVERY_FAILED',
      'The verification email could not be sent. Please try again.'
    );
  }

  return {
    challengeId: challenge.challengeId,
    expiresInSeconds: challenge.expiresInSeconds,
    delivery: {
      channel: 'email',
      destination: maskEmail(user.email),
    },
  };
}

async function revokeOtherSessions(userId, currentSid, reason) {
  const sessions = await sessionRepository.listActiveByUser(userId);
  const revokedSessionIds = sessions
    .map((session) => String(session._id))
    .filter((sessionId) => sessionId !== String(currentSid));
  await Promise.all([
    sessionRepository.revokeAllExcept(userId, currentSid, reason),
    refreshTokenRepository.revokeAllExceptSession(userId, currentSid, reason),
    ...revokedSessionIds.map((sessionId) => tokenBlacklist.revokeSession(sessionId)),
  ]);
}

export const authService = {
  async register({ email, password, name }, { device = '', ip = '', correlationId = null } = {}) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await userRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw new ApiError(409, 'EMAIL_EXISTS', 'An account with this email already exists');
    }

    const passwordHash = await passwordService.hash(password);
    const userId = userRepository.newId();
    const pendingEvent = buildUserRegisteredEvent(
      { _id: userId, email: normalizedEmail },
      { correlationId },
      { name: name ? String(name).trim().slice(0, 100) : undefined }
    );
    const user = await userRepository.create({
      id: userId,
      email: normalizedEmail,
      passwordHash,
      pendingEvent,
    });

    await authLogRepository.record({
      userId: user._id,
      event: 'user_registered',
      ip,
      device,
      correlationId,
    });

    // Registration proves control of neither an existing session nor a second
    // factor. Keep account creation separate from authentication: credentials
    // are issued only by login (and, when enabled, only after 2FA verification).
    return { registered: true };
  },

  async login({ email, password }, { device = '', ip = '' } = {}) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await userRepository.findByEmail(normalizedEmail);

    if (!user) {
      await bcrypt.compare(password, '$2b$12$LJ5n0O6e1n2B7y4g8D5Z9eHm5cQbG1xYzAbCdEfGhIjKlMnOpQrStU');
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    const matches = await passwordService.compare(password, user.passwordHash);
    if (!matches) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    if (user.status !== 'active') {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (user.twoFAEnabled) {
      const challenge = await deliverTwoFactorChallenge(user, 'login');
      await authLogRepository.record({
        userId: user._id,
        event: 'login_two_factor_challenged',
        ip,
        device,
      });
      return { requiresTwoFactor: true, ...challenge };
    }

    const credentials = await sessionService.issueCredentials({ user, device, ip });
    await authLogRepository.record({ userId: user._id, event: 'login', ip, device });
    return { requiresTwoFactor: false, credentials };
  },

  async verifyTwoFactorLogin({ challengeId, code }, { device = '', ip = '' } = {}) {
    const challenge = await twoFactorChallengeService.verify(challengeId, code, 'login');
    const user = await userRepository.findById(challenge.userId);
    if (!user || user.status !== 'active') {
      throw new ApiError(401, 'ACCOUNT_UNAVAILABLE', 'This account is no longer available.');
    }
    if (!user.twoFAEnabled) {
      throw new ApiError(409, 'TWO_FACTOR_NOT_ENABLED', 'Email two-factor authentication is not enabled');
    }
    const credentials = await sessionService.issueCredentials({ user, device, ip });
    await authLogRepository.record({
      userId: user._id,
      event: 'two_factor_login',
      ip,
      device,
    });
    return { credentials };
  },

  async refresh(rawRefreshToken, { device = '', ip = '' } = {}) {
    const { refreshToken, sessionId, user } = await refreshTokenService.rotate({ rawToken: rawRefreshToken });
    const { accessToken, csrfToken } = await sessionService.issueAccessAfterRotation({ user, sessionId });
    await authLogRepository.record({ userId: user._id, event: 'refresh', ip, device });
    return { accessToken, refreshToken, csrfToken };
  },

  async me(claims) {
    const user = await userRepository.findById(claims.sub);
    if (!user || user.status !== 'active') {
      throw new ApiError(401, 'ACCOUNT_UNAVAILABLE', 'This account is no longer available.');
    }
    if (user.tokenVersion !== claims.tokenVersion) {
      throw new ApiError(401, 'SESSION_INVALIDATED', 'Your session has been invalidated.');
    }
    return sanitizeUser(user);
  },

  async logout({ claims, refreshCookie }, { ip = '', device = '' } = {}) {
    if (claims) {
      const sid = claims.sid;
      const jti = claims.jti;
      await this.revokeSessionCredentials(sid, 'logout', claims.sub, jti, ip, device);
      return true;
    }
    if (refreshCookie) {
      const { hashRefreshToken } = await import('../utils/tokens.js');
      const stored = await refreshTokenRepository.findByHash(hashRefreshToken(refreshCookie));
      if (!stored) {
        throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'No active session found');
      }
      await sessionRepository.revokeById(stored.sessionId, 'logout');
      await refreshTokenRepository.revokeBySession(stored.sessionId, 'logout');
      await tokenBlacklist.revokeSession(String(stored.sessionId));
      await authLogRepository.record({
        userId: stored.userId,
        event: 'logout',
        detail: 'cookie_session',
        ip,
        device,
      });
      return true;
    }
    throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required to log out');
  },

  async revokeSessionCredentials(sid, reason, userId, jti, ip = '', device = '') {
    await sessionRepository.revokeById(sid, reason);
    await refreshTokenRepository.revokeBySession(sid, reason);
    await tokenBlacklist.revokeSession(String(sid));
    if (jti) {
      await tokenBlacklist.revokeJti(jti);
      await revokedTokenRepository
        .create({ jti, userId, sid, expiresAt: addDays(new Date(), 1) })
        .catch(() => {});
    }
    await authLogRepository.record({ userId, event: reason, ip, device });
  },

  async logoutAll({ claims }, { ip = '', device = '' } = {}) {
    const userId = claims.sub;
    await sessionRepository.revokeAllForUser(userId, 'logout_all');
    await refreshTokenRepository.revokeAllForUser(userId, 'logout_all');
    await tokenBlacklist.revokeJti(claims.jti);
    await revokedTokenRepository
      .create({
        jti: claims.jti,
        userId,
        sid: claims.sid,
        expiresAt: addDays(new Date(), 1),
      })
      .catch(() => {});

    const user = await userRepository.incrementTokenVersion(userId);
    if (user) {
      await tokenBlacklist.setTokenVersion(userId, user.tokenVersion);
    }
    await authLogRepository.record({ userId, event: 'logout_all', ip, device });
    return true;
  },

  async listSessions(userId, currentSid) {
    const sessions = await sessionRepository.listActiveByUser(userId);
    return sessions.map((session) => ({
      id: String(session._id),
      device: session.device,
      ip: session.ip,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      current: String(session._id) === String(currentSid),
    }));
  },

  async revokeSession(userId, sessionId, { ip = '', device = '' } = {}) {
    const session = await sessionRepository.findById(sessionId);
    if (!session || String(session.userId) !== String(userId)) {
      throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session not found');
    }
    await sessionRepository.revokeById(session._id, 'user_revoked');
    await refreshTokenRepository.revokeBySession(session._id, 'user_revoked');
    await tokenBlacklist.revokeSession(String(session._id));
    await authLogRepository.record({
      userId,
      event: 'session_revoked',
      detail: `session=${session._id}`,
      ip,
      device,
    });
    return true;
  },

  async twoFactorSetup(userId, password, { ip = '', device = '' } = {}) {
    const user = await userRepository.findById(userId);
    if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
    if (user.twoFAEnabled) {
      throw new ApiError(409, 'TWO_FA_ALREADY_ENABLED', 'Two-factor authentication is already enabled');
    }
    const matches = await passwordService.compare(password, user.passwordHash);
    if (!matches) {
      throw new ApiError(403, 'INVALID_CREDENTIALS', 'Current password is incorrect');
    }
    const challenge = await deliverTwoFactorChallenge(user, 'setup');
    await authLogRepository.record({ userId, event: 'two_factor_setup_started', ip, device });
    return challenge;
  },

  async twoFactorSetupVerify(userId, currentSid, challengeId, code, { ip = '', device = '' } = {}) {
    const user = await userRepository.findById(userId);
    if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
    if (user.twoFAEnabled) {
      throw new ApiError(409, 'TWO_FA_ALREADY_ENABLED', 'Two-factor authentication is already enabled');
    }
    const challenge = await twoFactorChallengeService.verify(challengeId, code, 'setup');
    if (String(challenge.userId) !== String(userId)) {
      throw new ApiError(403, 'FORBIDDEN', 'This verification challenge belongs to another account');
    }

    user.twoFAEnabled = true;
    await user.save();
    await revokeOtherSessions(userId, currentSid, 'two_factor_enabled');

    await authLogRepository.record({ userId, event: 'two_factor_enabled', ip, device });
    return true;
  },

  async twoFactorReset(userId, currentSid, password, { ip = '', device = '' } = {}) {
    const user = await userRepository.findById(userId);
    if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
    if (!user.twoFAEnabled) {
      throw new ApiError(400, 'TWO_FA_NOT_SETUP', 'Two-factor authentication is not enabled');
    }
    const matches = await passwordService.compare(password, user.passwordHash);
    if (!matches) {
      throw new ApiError(403, 'INVALID_CREDENTIALS', 'Current password is incorrect');
    }
    user.twoFAEnabled = false;
    await user.save();
    await revokeOtherSessions(userId, currentSid, 'two_factor_disabled');
    await authLogRepository.record({ userId, event: 'two_factor_reset', ip, device });
    return true;
  },

  async deleteAccount(userId, password, { ip = '', device = '', correlationId = null } = {}) {
    const user = await userRepository.findById(userId);
    if (!user || user.status !== 'active') {
      throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    const matches = await passwordService.compare(password, user.passwordHash);
    if (!matches) {
      throw new ApiError(403, 'INVALID_CREDENTIALS', 'Current password is incorrect');
    }

    const pendingEvent = buildUserDeletedEvent(userId, { correlationId });
    const updated = await userRepository.markDeleted(userId, pendingEvent);
    if (!updated) {
      throw new ApiError(409, 'ACCOUNT_UNAVAILABLE', 'This account is no longer available');
    }
    await sessionRepository.revokeAllForUser(userId, 'account_deleted');
    await refreshTokenRepository.revokeAllForUser(userId, 'account_deleted');
    await tokenBlacklist.setTokenVersion(userId, updated.tokenVersion);
    await authLogRepository.record({ userId, event: 'account_deleted', ip, device });

    return { deleted: true };
  },
};
