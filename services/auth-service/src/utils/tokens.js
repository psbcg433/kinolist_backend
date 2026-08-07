import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function generateRefreshToken() {
  return randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function generateFamilyId() {
  return randomBytes(24).toString('base64url');
}

export function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function randomToken(bytes = 24) {
  return randomBytes(bytes).toString('base64url');
}
