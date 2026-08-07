// Test-only environment seeding. Must be imported FIRST in every test file so
// that config/env.js validation passes without real infrastructure.
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.MONGO_URI = 'mongodb://localhost:27017/kinolist_auth_test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_ALGORITHM = 'HS256';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-long-enough-for-hs256';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_ISSUER = 'kinolist-auth';
process.env.JWT_AUDIENCE = 'kinolist-api';
process.env.CSRF_SECRET = 'test-csrf-secret';
process.env.TOTP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';
