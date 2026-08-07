import { getRedis } from '../config/redis.js';
import { randomToken } from '../utils/tokens.js';
import { ApiError } from '../utils/ApiError.js';

const CHALLENGE_TTL_SECONDS = 300;

export const twoFactorChallengeService = {
  async create(userId) {
    const redis = getRedis();
    const challengeId = randomToken(24);
    await redis.set(`auth:2fa:challenge:${challengeId}`, String(userId), 'EX', CHALLENGE_TTL_SECONDS);
    return challengeId;
  },

  /** Single-use: consumes the challenge and returns the userId, or null. */
  async consume(challengeId) {
    if (!challengeId) return null;
    const redis = getRedis();
    const userId = await redis.getdel(`auth:2fa:challenge:${challengeId}`);
    return userId ? { userId } : null;
  },
};

export { ApiError };
