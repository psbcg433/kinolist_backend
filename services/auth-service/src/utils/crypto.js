import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from '../config/env.js';
import { ApiError } from './ApiError.js';

const ALGORITHM = 'aes-256-gcm';

function key() {
  const raw = Buffer.from(config.totpEncryptionKey, 'utf8');
  return Buffer.from(config.totpEncryptionKey, 'hex').length === 32
    ? Buffer.from(config.totpEncryptionKey, 'hex')
    : require32Bytes(raw);
}

function require32Bytes(raw) {
  if (raw.length !== 32) {
    throw new ApiError(500, 'CONFIG_ERROR', 'TOTP_ENCRYPTION_KEY must be 64 hex chars (32 bytes) or exactly 32 bytes');
  }
  return raw;
}

export function encryptSecret(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptSecret(payload) {
  try {
    const [ivB64, tagB64, dataB64] = payload.split('.');
    const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    throw new ApiError(500, 'SECRET_DECRYPT_FAILED', 'Unable to decrypt TOTP secret');
  }
}
