import { config } from '../config/env.js';
import { jwtService } from './jwtService.js';
import { csrfService } from './csrfService.js';
import { sessionRepository } from '../repositories/sessionRepository.js';
import { refreshTokenRepository } from '../repositories/refreshTokenRepository.js';
import { addDays } from './cookieService.js';
import { generateRefreshToken, hashRefreshToken, generateFamilyId } from '../utils/tokens.js';

export const sessionService = {
  async issueCredentials({ user, device = '', ip = '' }) {
    const now = new Date();
    const familyId = generateFamilyId();
    const session = await sessionRepository.create({
      userId: user._id,
      tokenFamilyId: familyId,
      device,
      ip,
      expiresAt: addDays(now, config.sessionTtlDays),
    });

    const refreshToken = generateRefreshToken();
    await refreshTokenRepository.create({
      tokenHash: hashRefreshToken(refreshToken),
      familyId,
      sessionId: session._id,
      userId: user._id,
      expiresAt: addDays(now, config.refreshTokenTtlDays),
    });

    const accessToken = jwtService.signAccessToken({
      userId: String(user._id),
      role: user.role,
      sid: String(session._id),
      tokenVersion: user.tokenVersion,
    });
    const csrfToken = csrfService.generate(String(session._id));

    return {
      session,
      user,
      accessToken,
      refreshToken,
      csrfToken,
    };
  },

  async issueAccessAfterRotation({ user, sessionId }) {
    const accessToken = jwtService.signAccessToken({
      userId: String(user._id),
      role: user.role,
      sid: String(sessionId),
      tokenVersion: user.tokenVersion,
    });
    const csrfToken = csrfService.generate(String(sessionId));
    return { accessToken, csrfToken };
  },
};
