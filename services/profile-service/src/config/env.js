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
  port: optionalInt('PORT', 5002),
  mongoUri: required('MONGO_URI'),
  redisUrl: required('REDIS_URL'),
  cloudinary: {
    cloudName: required('CLOUDINARY_CLOUD_NAME'),
    apiKey: required('CLOUDINARY_API_KEY'),
    apiSecret: required('CLOUDINARY_API_SECRET'),
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
  maxImageBytes: optionalInt('MAX_IMAGE_BYTES', 5 * 1024 * 1024),
};

export { config };
