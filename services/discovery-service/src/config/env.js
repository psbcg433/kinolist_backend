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
  port: optionalInt('PORT', 5005),
  mongoUri: required('MONGO_URI'),
  redisUrl: required('REDIS_URL'),
  internalKey: required('INTERNAL_API_KEY'),
  peers: {
    movieServiceUrl: optional('MOVIE_SERVICE_URL', 'http://movie-service:5004'),
    libraryServiceUrl: optional('LIBRARY_SERVICE_URL', 'http://library-service:5003'),
    internalTimeoutMs: optionalInt('INTERNAL_TIMEOUT_MS', 8000),
  },
  tasteDive: {
    apiKey: required('TASTEDIVE_API_KEY'),
    baseUrl: optional('TASTEDIVE_BASE_URL', 'https://tastedive.com/api/similar'),
    timeoutMs: optionalInt('TASTEDIVE_TIMEOUT_MS', 8000),
  },
  openRouter: {
    apiKey: required('OPENROUTER_API_KEY'),
    baseUrl: optional('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1/chat/completions'),
    model: optional('OPENROUTER_MODEL', 'openai/gpt-4o-mini'),
    timeoutMs: optionalInt('OPENROUTER_TIMEOUT_MS', 15000),
  },
  jwt: {
    algorithm: jwtAlgorithm,
    publicKey: optional('JWT_ACCESS_PUBLIC_KEY', ''),
    secret: optional('JWT_ACCESS_SECRET', ''),
    issuer: optional('JWT_ISSUER', 'kinolist-auth'),
    audience: optional('JWT_AUDIENCE', 'kinolist-api'),
  },
  redis: {
    stream: optional('REDIS_STREAM', 'kinolist:stream:domain-events'),
    dlq: optional('REDIS_DLQ', 'kinolist:stream:domain-events:dlq'),
  },
  caches: {
    feedTtl: optionalInt('DISCOVERY_FEED_CACHE_TTL', 21600),
    recommendTtl: optionalInt('DISCOVERY_RECOMMEND_CACHE_TTL', 1800),
  },
  limits: {
    searchHistoryCap: optionalInt('SEARCH_HISTORY_CAP', 50),
    maxAiResults: optionalInt('MAX_AI_RESULTS', 5),
    maxRecommendResolve: optionalInt('MAX_RECOMMEND_RESOLVE', 8),
  },
};

export { config };
