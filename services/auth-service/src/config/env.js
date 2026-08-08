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

function optionalBool(name, fallback = false) {
  const value = optional(name, String(fallback)).toLowerCase();
  if (!['true', 'false'].includes(value)) {
    throw new Error(`Environment variable ${name} must be true or false`);
  }
  return value === 'true';
}

const nodeEnv = optional('NODE_ENV', 'development');
const isProduction = () => nodeEnv === 'production';
const cookieSecure = optional('COOKIE_SECURE', 'true') === 'true';
const cookieSameSite = optional('COOKIE_SAMESITE', 'none').toLowerCase();

if (!['strict', 'lax', 'none'].includes(cookieSameSite)) {
  throw new Error('COOKIE_SAMESITE must be strict, lax or none');
}
if (cookieSameSite === 'none' && !cookieSecure) {
  throw new Error('COOKIE_SECURE must be true when COOKIE_SAMESITE=none');
}
if (isProduction() && !cookieSecure) {
  throw new Error('COOKIE_SECURE must be true in production');
}

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
  twoFactor: {
    codePepper: required('TOTP_ENCRYPTION_KEY'),
    codeTtlSeconds: optionalInt('TWO_FACTOR_CODE_TTL_SECONDS', 300),
    maxAttempts: optionalInt('TWO_FACTOR_CODE_MAX_ATTEMPTS', 5),
  },
  smtp: {
    host: optional('SMTP_HOST', 'localhost'),
    port: optionalInt('SMTP_PORT', 1025),
    secure: optionalBool('SMTP_SECURE', false),
    requireTls: optionalBool('SMTP_REQUIRE_TLS', false),
    rejectUnauthorized: optionalBool('SMTP_TLS_REJECT_UNAUTHORIZED', true),
    user: optional('SMTP_USER', ''),
    pass: optional('SMTP_PASS', ''),
    from: optional('SMTP_FROM', 'KinoList <no-reply@kinolist.local>'),
  },
  sessionTtlDays: optionalInt('SESSION_TTL_DAYS', 30),
  refreshTokenTtlDays: optionalInt('REFRESH_TOKEN_TTL_DAYS', 30),
  cookie: {
    name: optional('COOKIE_NAME', 'kinolist_refresh'),
    path: optional('COOKIE_PATH', '/api'),
    secure: cookieSecure,
    sameSite: cookieSameSite,
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

if (config.twoFactor.codeTtlSeconds < 60 || config.twoFactor.codeTtlSeconds > 900) {
  throw new Error('TWO_FACTOR_CODE_TTL_SECONDS must be between 60 and 900');
}
if (config.twoFactor.maxAttempts < 1 || config.twoFactor.maxAttempts > 10) {
  throw new Error('TWO_FACTOR_CODE_MAX_ATTEMPTS must be between 1 and 10');
}
if (Boolean(config.smtp.user) !== Boolean(config.smtp.pass)) {
  throw new Error('SMTP_USER and SMTP_PASS must either both be set or both be empty');
}

export { config };
