import test from 'node:test';
import assert from 'node:assert/strict';
import './env-setup.mjs';
import { csrfService } from '../src/services/csrfService.js';
import { jwtService } from '../src/services/jwtService.js';
import { hashRefreshToken, safeEqual, generateRefreshToken } from '../src/utils/tokens.js';
import { ApiError } from '../src/utils/ApiError.js';
import { authController } from '../src/controllers/authController.js';
import { authService, sanitizeUser } from '../src/services/authService.js';
import { requireCsrfCookieIfAnonymous } from '../src/middleware/requireCsrf.js';
import { dispatchPendingUserEvents } from '../src/events/dispatchers/userEventDispatcher.js';

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

test('me returns the sanitized service DTO without sanitizing it again', async () => {
  const expected = {
    id: 'user-1',
    email: 'alice@example.com',
    role: 'USER',
    twoFAEnabled: false,
  };
  const originalMe = authService.me;
  authService.me = async () => expected;

  let responseBody;
  const res = {
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  try {
    await authController.me(
      { auth: { claims: { sub: 'user-1' } } },
      res,
      (err) => {
        throw err;
      }
    );
    assert.equal(res.statusCode, 200);
    assert.deepEqual(responseBody.data.user, expected);
    assert.equal(responseBody.user, undefined);
    assert.deepEqual(Object.keys(responseBody), ['success', 'data', 'meta', 'requestId']);
  } finally {
    authService.me = originalMe;
  }
});

test('auth user DTO excludes password, token state, timestamps, and profile-owned fields', () => {
  assert.deepEqual(sanitizeUser({
    _id: 'user-1',
    email: 'alice@example.com',
    role: 'USER',
    twoFAEnabled: true,
    passwordHash: 'secret-hash',
    tokenVersion: 9,
    twoFASecretEncrypted: 'encrypted-secret',
    name: 'Profile-owned name',
    createdAt: new Date(),
  }), {
    id: 'user-1',
    email: 'alice@example.com',
    role: 'USER',
    twoFAEnabled: true,
  });
});

test('cookie-authenticated logout requires a session-bound CSRF token', () => {
  const req = { headers: {}, refreshSession: { sid: 'session-123' } };
  let received;
  requireCsrfCookieIfAnonymous(req, {}, (err) => { received = err; });
  assert.ok(received instanceof ApiError);
  assert.equal(received.status, 403);
  assert.equal(received.code, 'CSRF_INVALID');
});

test('Bearer-authenticated logout does not require cookie CSRF middleware', () => {
  const req = { auth: { claims: { sid: 'session-123' } }, headers: {} };
  let received = 'not-called';
  requireCsrfCookieIfAnonymous(req, {}, (err) => { received = err; });
  assert.equal(received, undefined);
});

test('user event outbox acknowledges only successfully published events', async () => {
  const acknowledged = [];
  const repository = {
    async listWithPendingEvents() {
      return [{
        _id: 'user-1',
        pendingEvents: [
          { eventId: 'event-1', eventType: 'USER_REGISTERED.v1' },
          { eventId: 'event-2', eventType: 'USER_DELETED.v1' },
        ],
      }];
    },
    async acknowledgePendingEvent(userId, eventId) {
      acknowledged.push([userId, eventId]);
    },
  };
  const publish = async (event) => event.eventId === 'event-1';

  const count = await dispatchPendingUserEvents({ repository, publish });
  assert.equal(count, 1);
  assert.deepEqual(acknowledged, [['user-1', 'event-1']]);
});
