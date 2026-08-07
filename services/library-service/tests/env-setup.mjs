process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/kinolist_library_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.INTERNAL_API_KEY = 'test-internal-key';
process.env.JWT_ALGORITHM = 'HS256';
process.env.JWT_ACCESS_SECRET = 'test-secret-0123456789abcdef0123456789abcdef';
