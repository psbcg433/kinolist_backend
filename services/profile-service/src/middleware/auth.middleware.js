import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { getRedis } from '../config/redis.js';
import { logger } from '../utils/logger.js';

function verifyingKey() {
  return config.jwt.algorithm === 'RS256' ? config.jwt.publicKey : config.jwt.secret;
}

export function verifyAccessToken(token) {
  // Restricted to the configured algorithm only — never accept arbitrary JWT
  // algorithms (prevents confusion attacks).
  return jwt.verify(token, verifyingKey(), {
    algorithms: [config.jwt.algorithm],
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
}

async function checkRevocation(req) {
  try {
    const redis = getRedis();
    const results = await redis
      .multi()
      .exists(`auth:blacklist:${req.auth.jti}`)
      .exists(`auth:sid-revoked:${req.auth.sid}`)
      .get(`auth:tv:${req.auth.userId}`)
      .exec();

    if (results[0][1] === 1) {
      throw new ApiError(401, 'TOKEN_REVOKED', 'Access token has been revoked');
    }
    if (results[1][1] === 1) {
      throw new ApiError(401, 'SESSION_REVOKED', 'Your session has been revoked');
    }
    const currentTv = results[2][1];
    if (currentTv !== null && Number(currentTv) !== req.auth.tokenVersion) {
      throw new ApiError(401, 'TOKEN_VERSION_CHANGED', 'Your session has been invalidated');
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // Fail-open on Redis outage for the revocation cache. JWTs are still
    // cryptographically verified. Documented in docs/architecture.md.
    logger.warn('auth_redis_check_failed', { message: err.message });
  }
}

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Access token is required');
    }
    const token = header.slice(7).trim();
    let claims;
    try {
      claims = verifyAccessToken(token);
    } catch {
      throw new ApiError(401, 'INVALID_ACCESS_TOKEN', 'Invalid or expired access token');
    }
    if (!claims.sub || !claims.sid || !claims.jti) {
      throw new ApiError(401, 'INVALID_ACCESS_TOKEN', 'Access token missing required claims');
    }
    req.auth = {
      userId: String(claims.sub),
      role: claims.role || 'USER',
      sid: String(claims.sid),
      jti: String(claims.jti),
      tokenVersion: claims.tokenVersion,
    };
    await checkRevocation(req);
    next();
  } catch (err) {
    next(err);
  }
}
