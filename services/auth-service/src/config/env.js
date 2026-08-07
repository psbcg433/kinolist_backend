import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return value;
}

function optionalInt(name, fallback) {
  const value = parseInt(optional(name, String(fallback)), 10);
  if (Number.isNaN(value)) throw new Error(`Environment variable ${name} must be an integer`);
  return value;
}

const nodeEnv = optional('NODE_ENV', 'development');
const isProduction = () => nodeEnv === 'production';

const jwtAlgorithm = optional('JWT_ALGORITHM', 'RS256');
if (jwtAlgorithm !== 'RS256' && jwtAlgorithm !== 'HS256') {
  throw new Error('JWT_ALGORITHM must be RS256 or HS256');
}
if (jwtAlgorithm === 'RS256') {
  if (!optional('JWT_ACCESS_PRIVATE_KEY', '')) {
    throw new Error('JWT_ACCESS_PRIVATE_KEY is required when JWT_ALGORITHM=RS256');
  }
  if (!optional('JWT_ACCESS_PUBLIC_KEY', '')) {
    throw new Error('JWT_ACCESS_PUBLIC_KEY is required when JWT_ALGORITHM=RS256');
  }
} else if (!optional('JWT_ACCESS_SECRET', '')) {
  throw new Error('JWT_ACCESS_SECRET is required when JWT_ALGORITHM=HS256');
}

const config = {
  nodeEnv,
  isProduction,
  port: optionalInt('PORT', 5001),
  mongoUri: required('MONGO_URI'),
  redisUrl: required('REDIS_URL'),
  jwt: {
    algorithm: jwtAlgorithm,
    privateKey: optional('JWT_ACCESS_PRIVATE_KEY', ''),
    publicKey: optional('JWT_ACCESS_PUBLIC_KEY', ''),
    secret: optional('JWT_ACCESS_SECRET', ''),
    accessTtl: optional('JWT_ACCESS_TTL', '15m'),
    issuer: optional('JWT_ISSUER', 'kinolist-auth'),
    audience: optional('JWT_AUDIENCE', 'kinolist-api'),
  },
  csrfSecret: required('CSRF_SECRET'),
  totpEncryptionKey: required('TOTP_ENCRYPTION_KEY'),
  sessionTtlDays: optionalInt('SESSION_TTL_DAYS', 30),
  refreshTokenTtlDays: optionalInt('REFRESH_TOKEN_TTL_DAYS', 30),
  cookie: {
    name: optional('COOKIE_NAME', 'kinolist_refresh'),
    path: optional('COOKIE_PATH', '/api/auth'),
    secure: optional('COOKIE_SECURE', 'true') === 'true',
    sameSite: optional('COOKIE_SAMESITE', 'none'),
  },
  redis: {
    stream: optional('REDIS_STREAM', 'kinolist:stream:domain-events'),
    dlq: optional('REDIS_DLQ', 'kinolist:stream:domain-events:dlq'),
  },
  rateLimit: {
    windowMs: optionalInt('RATE_LIMIT_WINDOW_MS', 60_000),
    loginMax: optionalInt('RATE_LIMIT_LOGIN_MAX', 10),
    registerMax: optionalInt('RATE_LIMIT_REGISTER_MAX', 5),
    twoFAMax: optionalInt('RATE_LIMIT_2FA_MAX', 10),
    refreshMax: optionalInt('RATE_LIMIT_REFRESH_MAX', 30),
    deleteAccountMax: optionalInt('RATE_LIMIT_DELETE_ACCOUNT_MAX', 5),
  },
  bcryptRounds: optionalInt('BCRYPT_ROUNDS', 12),
};

export { config };
