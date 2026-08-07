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
  if (Number.isNaN(value)) {
    throw new Error(`Environment variable ${name} must be an integer`);
  }
  return value;
}

function splitList(name, fallback = '') {
  return optional(name, fallback)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const config = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: optionalInt('PORT', 5000),
  redisUrl: required('REDIS_URL'),
  serviceUrls: {
    auth: required('AUTH_SERVICE_URL'),
    profile: required('PROFILE_SERVICE_URL'),
    library: required('LIBRARY_SERVICE_URL'),
    movie: required('MOVIE_SERVICE_URL'),
    discovery: required('DISCOVERY_SERVICE_URL'),
  },
  frontendOrigins: splitList('FRONTEND_ORIGINS', 'http://localhost:3000,http://localhost:5173'),
  maxBodyBytes: optionalInt('MAX_BODY_BYTES', 10 * 1024 * 1024),
  rateLimitWindowMs: optionalInt('RATE_LIMIT_WINDOW_MS', 60_000),
  rateLimitMax: optionalInt('RATE_LIMIT_MAX', 300),
  upstreamTimeoutMs: optionalInt('UPSTREAM_TIMEOUT_MS', 15_000),
  jwt: {
    algorithm: optional('JWT_ALGORITHM', 'RS256'),
    publicKey: optional('JWT_ACCESS_PUBLIC_KEY', ''),
    secret: optional('JWT_ACCESS_SECRET', ''),
    issuer: optional('JWT_ISSUER', 'kinolist-auth'),
    audience: optional('JWT_AUDIENCE', 'kinolist-api'),
  },
};

const isProduction = () => config.nodeEnv === 'production';

export { config, isProduction };
