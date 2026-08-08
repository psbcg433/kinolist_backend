import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, errorBody } from '../src/utils/ApiError.js';
import { requestId } from '../src/middleware/requestId.js';
import { upstreamPath } from '../src/routes/proxy.js';
import { stripHopByHopHeaders } from '../src/middleware/security.js';
import { bodyLimit } from '../src/middleware/bodyLimit.js';
import { sendSuccess } from '../src/utils/response.js';

test('errorBody produces the stable error envelope for client errors', () => {
  const err = new ApiError(403, 'FORBIDDEN', 'Nope', [{ field: 'x' }]);
  const body = errorBody(err, 'req-1');
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'FORBIDDEN');
  assert.equal(body.error.message, 'Nope');
  assert.equal(body.requestId, 'req-1');
  assert.equal(body.message, undefined);
});

test('errorBody hides internals for server errors', () => {
  const err = new Error('mongo exploded at host 10.0.0.5');
  const body = errorBody(err, 'req-2');
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'INTERNAL_ERROR');
  assert.equal(body.error.message, 'Internal server error');
  assert.ok(!body.error.message.includes('mongo'));
});

test('requestId generates and propagates an id', () => {
  const req = { headers: {} };
  const res = { setHeader(name, value) { this[name] = value; } };
  let called = false;
  requestId(req, res, () => { called = true; });
  assert.ok(called);
  assert.ok(req.id.length > 0);
  assert.equal(res['X-Request-Id'], req.id);
});

test('requestId honours a valid incoming X-Request-Id', () => {
  const req = { headers: { 'x-request-id': 'client-supplied-id' } };
  const res = { setHeader() {} };
  requestId(req, res, () => {});
  assert.equal(req.id, 'client-supplied-id');
});

test('upstreamPath preserves service prefixes but strips the auth prefix', () => {
  assert.equal(upstreamPath('/api/user', '/me'), '/api/user/me');
  assert.equal(upstreamPath('/api/search', '/?q=inception'), '/api/search/?q=inception');
  assert.equal(upstreamPath('/api/auth', '/login', { stripPrefix: true }), '/login');
});

test('security middleware deletes unsafe headers instead of leaving undefined values', () => {
  const req = {
    headers: {
      connection: 'keep-alive',
      'transfer-encoding': 'chunked',
      'x-user-id': 'spoofed-user',
      'x-role': 'ADMIN',
      'x-internal-key': 'spoofed-internal-secret',
      'x-forwarded-for': '203.0.113.50',
      'x-forwarded-proto': 'https',
      authorization: 'Bearer safe-to-forward',
      'content-type': 'application/json',
    },
    ip: '127.0.0.1',
  };
  let nextCalled = false;

  stripHopByHopHeaders(req, {}, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(Object.hasOwn(req.headers, 'connection'), false);
  assert.equal(Object.hasOwn(req.headers, 'transfer-encoding'), false);
  assert.equal(Object.hasOwn(req.headers, 'x-user-id'), false);
  assert.equal(Object.hasOwn(req.headers, 'x-role'), false);
  assert.equal(Object.hasOwn(req.headers, 'x-internal-key'), false);
  assert.equal(Object.hasOwn(req.headers, 'x-forwarded-for'), false);
  assert.equal(Object.hasOwn(req.headers, 'x-forwarded-proto'), false);
  assert.equal(req.headers.authorization, 'Bearer safe-to-forward');
  assert.equal(req.headers['content-type'], 'application/json');
  assert.equal(req.clientIp, '127.0.0.1');
  assert.equal(req.hadTransferEncoding, true);
  assert.equal(Object.values(req.headers).includes(undefined), false);
});

test('body limit rejects chunked requests after transport headers are stripped', () => {
  const req = { headers: {}, hadTransferEncoding: true };
  let received;
  bodyLimit()(req, {}, (err) => { received = err; });
  assert.equal(received.status, 411);
  assert.equal(received.code, 'CONTENT_LENGTH_REQUIRED');
});

test('body limit rejects invalid and oversized declared lengths', () => {
  for (const [value, status] of [['not-a-number', 400], ['999999999999', 413]]) {
    let received;
    bodyLimit()({ headers: { 'content-length': value } }, {}, (err) => { received = err; });
    assert.equal(received.status, status);
  }
});

test('body limit allows a bounded request', () => {
  let received = 'not-called';
  bodyLimit()({ headers: { 'content-length': '128' } }, {}, (err) => { received = err; });
  assert.equal(received, undefined);
});

test('success responses use only the standard envelope keys', () => {
  let body;
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(value) { body = value; return this; },
  };
  sendSuccess({ id: 'request-1' }, res, { movie: { id: 'm1' } }, { meta: { cached: true } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(body, {
    success: true,
    data: { movie: { id: 'm1' } },
    meta: { cached: true },
    requestId: 'request-1',
  });
  assert.deepEqual(Object.keys(body), ['success', 'data', 'meta', 'requestId']);
});
