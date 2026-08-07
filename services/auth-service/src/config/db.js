import mongoose from 'mongoose';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 5000,
  });
  logger.info('mongo_connected', { uri: redactUri(config.mongoUri) });
}

export async function disconnectDB() {
  await mongoose.disconnect().catch(() => {});
}

function redactUri(uri) {
  try {
    const url = new URL(uri);
    if (url.password) url.password = '[REDACTED]';
    return url.toString();
  } catch {
    return '[unparseable-uri]';
  }
}
