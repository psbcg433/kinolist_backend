import crypto from 'node:crypto';
import { getRedis } from '../config/redis.js';
import { config } from '../config/env.js';
import { randomToken } from '../utils/tokens.js';
import { ApiError } from '../utils/ApiError.js';

const keyFor = (challengeId) => `auth:2fa:challenge:${challengeId}`;
const activeKeyFor = (purpose, userId) => `auth:2fa:active:${purpose}:${userId}`;

function codeHash(challengeId, code) {
  return crypto
    .createHmac('sha256', config.twoFactor.codePepper)
    .update(`${challengeId}:${String(code)}`)
    .digest('hex');
}

function numericCode() {
  return String(crypto.randomInt(100000, 1000000));
}

const VERIFY_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return {'MISSING'} end
local value = cjson.decode(raw)
if value.purpose ~= ARGV[2] then return {'MISSING'} end
if value.codeHash ~= ARGV[1] then
  value.attempts = (value.attempts or 0) + 1
  if value.attempts >= tonumber(ARGV[3]) then
    redis.call('DEL', KEYS[1])
    if redis.call('GET', KEYS[2]) == ARGV[4] then redis.call('DEL', KEYS[2]) end
    return {'LOCKED'}
  end
  redis.call('SET', KEYS[1], cjson.encode(value), 'KEEPTTL')
  return {'INVALID', tostring(tonumber(ARGV[3]) - value.attempts)}
end
redis.call('DEL', KEYS[1])
if redis.call('GET', KEYS[2]) == ARGV[4] then redis.call('DEL', KEYS[2]) end
return {'OK', value.userId}
`;

export const twoFactorChallengeService = {
  async create(userId, purpose) {
    if (!['login', 'setup'].includes(purpose)) {
      throw new Error('Unsupported two-factor challenge purpose');
    }

    const redis = getRedis();
    const normalizedUserId = String(userId);
    const challengeId = randomToken(24);
    const code = numericCode();
    const activeKey = activeKeyFor(purpose, normalizedUserId);
    const previousChallengeId = await redis.get(activeKey);

    const record = JSON.stringify({
      userId: normalizedUserId,
      purpose,
      codeHash: codeHash(challengeId, code),
      attempts: 0,
    });

    const transaction = redis.multi();
    if (previousChallengeId) transaction.del(keyFor(previousChallengeId));
    transaction.set(keyFor(challengeId), record, 'EX', config.twoFactor.codeTtlSeconds);
    transaction.set(activeKey, challengeId, 'EX', config.twoFactor.codeTtlSeconds);
    await transaction.exec();

    return {
      challengeId,
      code,
      expiresInSeconds: config.twoFactor.codeTtlSeconds,
    };
  },

  async verify(challengeId, code, purpose) {
    if (!challengeId || !/^\d{6}$/.test(String(code || ''))) {
      throw new ApiError(400, 'INVALID_TWO_FACTOR_CODE', 'The verification code is invalid or has expired');
    }

    const redis = getRedis();
    const provisional = await redis.get(keyFor(challengeId));
    let userId = '';
    if (provisional) {
      try {
        userId = String(JSON.parse(provisional).userId || '');
      } catch {
        await redis.del(keyFor(challengeId));
      }
    }

    if (!userId) {
      throw new ApiError(410, 'CHALLENGE_INVALID', 'This verification attempt has expired. Please start again.');
    }

    const result = await redis.eval(
      VERIFY_SCRIPT,
      2,
      keyFor(challengeId),
      activeKeyFor(purpose, userId),
      codeHash(challengeId, code),
      purpose,
      String(config.twoFactor.maxAttempts),
      challengeId
    );

    const status = result?.[0];
    if (status === 'OK') return { userId: String(result[1]) };
    if (status === 'LOCKED') {
      throw new ApiError(429, 'TWO_FACTOR_CHALLENGE_LOCKED', 'Too many invalid codes. Please start again.');
    }
    if (status === 'INVALID') {
      throw new ApiError(400, 'INVALID_TWO_FACTOR_CODE', 'The verification code is invalid or has expired');
    }
    throw new ApiError(410, 'CHALLENGE_INVALID', 'This verification attempt has expired. Please start again.');
  },

  async cancel(challengeId, userId, purpose) {
    if (!challengeId) return;
    const redis = getRedis();
    const activeKey = activeKeyFor(purpose, userId);
    const transaction = redis.multi().del(keyFor(challengeId));
    if ((await redis.get(activeKey)) === challengeId) transaction.del(activeKey);
    await transaction.exec();
  },
};
