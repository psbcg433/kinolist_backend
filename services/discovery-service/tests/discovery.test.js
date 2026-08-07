import assert from 'node:assert/strict';
import { validateSearchQuery, validateGenre, validateUserId } from '../src/validators/discovery.validator.js';
import { tasteDiveSimilar } from '../src/providers/tasteDiveProvider.js';
import { ApiError } from '../src/utils/ApiError.js';

function expectError(fn, status, message) {
  try {
    fn();
    assert.fail(`expected ApiError: ${message}`);
  } catch (err) {
    assert.ok(err instanceof ApiError, `expected ApiError, got ${err.name}: ${err.message}`);
    assert.equal(err.status, status);
  }
}

const tests = {
  'validateSearchQuery trims and caps': () => {
    assert.equal(validateSearchQuery({ q: '  inception  ' }), 'inception');
    expectError(() => validateSearchQuery({}), 400, 'missing q');
    expectError(() => validateSearchQuery({ q: '   ' }), 400, 'blank q');
    expectError(() => validateSearchQuery({ q: 'x'.repeat(121) }), 400, 'overlong q');
  },

  'validateGenre lowercases': () => {
    assert.equal(validateGenre(' Action '), 'action');
    expectError(() => validateGenre(''), 400, 'empty genre');
    expectError(() => validateGenre(undefined), 400, 'missing genre');
  },

  'validateUserId enforces ownership': () => {
    assert.equal(validateUserId('u1', 'u1'), 'u1');
    expectError(() => validateUserId('u2', 'u1'), 403, 'foreign userId');
  },

  'tasteDiveSimilar normalizes uppercase payload to legacy shape': async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        Similar: {
          Results: [
            { Name: 'Inception', Type: 'movie', wTeaser: 'A heist.', wUrl: 'https://w', yUrl: 'https://y', yID: 'abc' },
          ],
        },
      }),
    });
    try {
      const out = await tasteDiveSimilar('dreams', { limit: 5 });
      assert.ok(out.similar, 'has similar');
      assert.equal(out.similar.results.length, 1);
      assert.deepEqual(out.similar.results[0], {
        name: 'Inception',
        type: 'movie',
        wTeaser: 'A heist.',
        wUrl: 'https://w',
        yUrl: 'https://y',
        yID: 'abc',
      });
    } finally {
      global.fetch = originalFetch;
    }
  },

  'tasteDiveSimilar handles already-lowercase payloads': async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ similar: { results: [{ Name: 'The Matrix', wUrl: 'x' }] } }),
    });
    try {
      const out = await tasteDiveSimilar('matrix');
      assert.equal(out.similar.results[0].name, 'The Matrix');
    } finally {
      global.fetch = originalFetch;
    }
  },
};

for (const [name, fn] of Object.entries(tests)) {
  await fn();
  console.log(`PASS ${name}`);
}
console.log(`OK ${Object.keys(tests).length} tests passed`);
