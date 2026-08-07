import test from 'node:test';
import assert from 'node:assert/strict';
import './env-setup.mjs';
import { csrfService } from '../src/services/csrfService.js';
import { jwtService } from '../src/services/jwtService.js';
import { hashRefreshToken, safeEqual, generateRefreshToken } from '../src/utils/tokens.js';
import { encryptSecret, decryptSecret } from '../src/utils/crypto.js';
import { ApiError } from '../src/utils/ApiError.js';

test('csrf tokens are session-bound', () => {
  const token = csrfService.generate('session-123');
  assert.equal(csrfService.verify(token, 'session-123'), true);
  assert.equal(csrfService.verify(token, 'session-124'), false);
  assert.equal(csrfService.verify(token, undefined), false);
  assert.equal(csrfService.verify('garbage', 'session-123'), false);
});

test('csrf tokens differ per session', () => {
  assert.notEqual(csrfService.generate('s1'), csrfService.generate('s2'));
});

test('access token carries required claims and verifies', () => {
  const token = jwtService.signAccessToken({
    userId: 'u1',
    role: 'USER',
    sid: 's1',
    tokenVersion: 3,
  });
  const claims = jwtService.verifyAccessToken(token);
  assert.equal(claims.sub, 'u1');
  assert.equal(claims.role, 'USER');
  assert.equal(claims.sid, 's1');
  assert.equal(claims.tokenVersion, 3);
  assert.ok(claims.jti && claims.jti.length > 0);
  assert.equal(claims.iss, 'kinolist-auth');
  assert.equal(claims.aud, 'kinolist-api');
  assert.ok(claims.exp > claims.iat);
});

test('access token rejects a tampered signature', () => {
  const token = jwtService.signAccessToken({ userId: 'u1', role: 'USER', sid: 's1', tokenVersion: 1 });
  const tampered = token.slice(0, -4) + 'AAAA';
  assert.throws(() => jwtService.verifyAccessToken(tampered), ApiError);
});

test('refresh token hashing is deterministic and salted', () => {
  const raw = 'abcdef';
  assert.equal(hashRefreshToken(raw), hashRefreshToken(raw));
  assert.notEqual(hashRefreshToken('abc'), hashRefreshToken('abd'));
  assert.ok(generateRefreshToken().length >= 48);
});

test('safeEqual handles length mismatch', () => {
  assert.equal(safeEqual('a', 'a'), true);
  assert.equal(safeEqual('a', 'ab'), false);
  assert.equal(safeEqual('x', 'y'), false);
});

test('TOTP secret encryption round-trips', () => {
  const encrypted = encryptSecret('SECRETBASE32');
  assert.notEqual(encrypted, 'SECRETBASE32');
  assert.equal(decryptSecret(encrypted), 'SECRETBASE32');
});
