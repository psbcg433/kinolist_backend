import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, errorBody } from '../src/utils/ApiError.js';
import { requestId } from '../src/middleware/requestId.js';

test('errorBody produces the stable error envelope for client errors', () => {
  const err = new ApiError(403, 'FORBIDDEN', 'Nope', [{ field: 'x' }]);
  const body = errorBody(err, 'req-1');
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'FORBIDDEN');
  assert.equal(body.error.message, 'Nope');
  assert.equal(body.requestId, 'req-1');
  assert.equal(body.message, 'Nope');
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
