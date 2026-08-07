import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

function signingKey() {
  return config.jwt.algorithm === 'RS256' ? config.jwt.privateKey : config.jwt.secret;
}

function verifyingKey() {
  return config.jwt.algorithm === 'RS256' ? config.jwt.publicKey : config.jwt.secret;
}

export const jwtService = {
  signAccessToken({ userId, role, sid, tokenVersion }) {
    const payload = {
      sub: userId,
      role: role || 'USER',
      sid,
      jti: randomUUID(),
      tokenVersion,
    };
    return jwt.sign(payload, signingKey(), {
      algorithm: config.jwt.algorithm,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      expiresIn: config.jwt.accessTtl,
    });
  },

  verifyAccessToken(token) {
    try {
      // Restrict to the configured algorithm only; never accept arbitrary
      // algorithms (prevents confusion attacks).
      return jwt.verify(token, verifyingKey(), {
        algorithms: [config.jwt.algorithm],
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(401, 'INVALID_ACCESS_TOKEN', 'Invalid or expired access token');
    }
  },
};
