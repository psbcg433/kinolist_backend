import assert from 'node:assert/strict';
import { validateImdbID, validateBatchIds, validateSearchQuery } from '../src/validators/movie.validator.js';
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
  'validateImdbID accepts valid ids': () => {
    assert.equal(validateImdbID('tt0111161'), 'tt0111161');
    assert.equal(validateImdbID('tt1375666'), 'tt1375666');
  },

  'validateImdbID rejects invalid ids': () => {
    expectError(() => validateImdbID('1375666'), 400, 'missing tt prefix');
    expectError(() => validateImdbID('tt13756'), 400, 'too short');
    expectError(() => validateImdbID(undefined), 400, 'undefined');
  },

  'validateBatchIds dedupes and caps at 20': () => {
    assert.deepEqual(validateBatchIds({ ids: ['tt0111161', 'tt0111161', 'tt1375666'] }), [
      'tt0111161',
      'tt1375666',
    ]);
  },

  'validateBatchIds rejects empty or oversized': () => {
    expectError(() => validateBatchIds({}), 400, 'missing ids');
    expectError(() => validateBatchIds({ ids: [] }), 400, 'empty ids');
    expectError(() => validateBatchIds({ ids: Array(21).fill('tt0111161') }), 400, 'too many ids');
  },

  'validateSearchQuery parses and defaults': () => {
    assert.deepEqual(validateSearchQuery({ q: '  inception  ' }), { query: 'inception', type: undefined, year: undefined });
    assert.deepEqual(validateSearchQuery({ q: 'batman', type: 'movie', y: '2024' }), { query: 'batman', type: 'movie', year: 2024 });
  },

  'validateSearchQuery rejects bad input': () => {
    expectError(() => validateSearchQuery({}), 400, 'missing q');
    expectError(() => validateSearchQuery({ q: 'x'.repeat(121) }), 400, 'long q');
    expectError(() => validateSearchQuery({ q: 'x', type: 'nope' }), 400, 'bad type');
    expectError(() => validateSearchQuery({ q: 'x', y: 'abcd' }), 400, 'bad year');
  },
};

for (const [name, fn] of Object.entries(tests)) {
  await fn();
  console.log(`PASS ${name}`);
}
console.log(`OK ${Object.keys(tests).length} tests passed`);
