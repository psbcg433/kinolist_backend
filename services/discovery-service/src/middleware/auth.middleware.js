import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { getRedis } from '../config/redis.js';
import { logger } from '../utils/logger.js';

function verifyingKey() {
  return config.jwt.algorithm === 'RS256' ? config.jwt.publicKey : config.jwt.secret;
}

export function verifyAccessToken(token) {
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
    logger.error('auth_redis_check_failed', { message: err.message });
    throw new ApiError(503, 'AUTHORIZATION_UNAVAILABLE', 'Authorization state is temporarily unavailable');
  }
}

function claimsToAuth(claims) {
  if (!claims.sub || !claims.sid || !claims.jti) {
    throw new ApiError(401, 'INVALID_ACCESS_TOKEN', 'Access token missing required claims');
  }
  return {
    userId: String(claims.sub),
    role: claims.role || 'USER',
    sid: String(claims.sid),
    jti: String(claims.jti),
    tokenVersion: claims.tokenVersion,
  };
}

function parseBearer(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

export async function requireAuth(req, _res, next) {
  try {
    const token = parseBearer(req);
    if (!token) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Access token is required');
    }
    let claims;
    try {
      claims = verifyAccessToken(token);
    } catch {
      throw new ApiError(401, 'INVALID_ACCESS_TOKEN', 'Invalid or expired access token');
    }
    req.auth = claimsToAuth(claims);
    await checkRevocation(req);
    next();
  } catch (err) {
    next(err);
  }
}

/** Search endpoints work anonymously but record history for signed-in users. */
export async function requireAuthIfPresent(req, _res, next) {
  try {
    const token = parseBearer(req);
    if (!token) return next();
    try {
      req.auth = claimsToAuth(verifyAccessToken(token));
    } catch {
      throw new ApiError(401, 'INVALID_ACCESS_TOKEN', 'Invalid or expired access token');
    }
    await checkRevocation(req);
    next();
  } catch (err) {
    next(err);
  }
}

export function requireInternal(req, _res, next) {
  const key = req.headers['x-internal-key'];
  if (!key || key !== config.internalKey) {
    return next(new ApiError(403, 'FORBIDDEN', 'Internal endpoint'));
  }
  next();
}
