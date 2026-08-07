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
if (jwtAlgorithm === 'RS256' && !optional('JWT_ACCESS_PUBLIC_KEY', '')) {
  throw new Error('JWT_ACCESS_PUBLIC_KEY is required when JWT_ALGORITHM=RS256');
}
if (jwtAlgorithm === 'HS256' && !optional('JWT_ACCESS_SECRET', '')) {
  throw new Error('JWT_ACCESS_SECRET is required when JWT_ALGORITHM=HS256');
}

const config = {
  nodeEnv,
  isProduction,
  port: optionalInt('PORT', 5004),
  mongoUri: required('MONGO_URI'),
  redisUrl: required('REDIS_URL'),
  internalKey: required('INTERNAL_API_KEY'),
  omdb: {
    apiKey: required('OMDB_API_KEY'),
    baseUrl: optional('OMDB_BASE_URL', 'https://www.omdbapi.com'),
    timeoutMs: optionalInt('OMDB_TIMEOUT_MS', 8000),
  },
  cache: {
    ttlSeconds: optionalInt('MOVIE_CACHE_TTL_SECONDS', 86400),
  },
  jwt: {
    algorithm: jwtAlgorithm,
    publicKey: optional('JWT_ACCESS_PUBLIC_KEY', ''),
    secret: optional('JWT_ACCESS_SECRET', ''),
    issuer: optional('JWT_ISSUER', 'kinolist-auth'),
    audience: optional('JWT_AUDIENCE', 'kinolist-api'),
  },
};

export { config };
