import assert from 'node:assert/strict';
import {
  validateCreate,
  validateLegacyCreate,
  validateUpdate,
  validateItem,
  validateLegacyItem,
} from '../src/validators/playlist.validator.js';
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
  'validateCreate trims and caps description': () => {
    const out = validateCreate({ name: '  Weekend Marathon  ', description: 'All the best ones' });
    assert.equal(out.name, 'Weekend Marathon');
    assert.equal(out.description, 'All the best ones');
  },

  'validateCreate rejects missing name': () => {
    expectError(() => validateCreate({}), 400, 'missing name');
    expectError(() => validateCreate({ name: '   ' }), 400, 'blank name');
  },

  'validateCreate rejects over-long name': () => {
    expectError(() => validateCreate({ name: 'x'.repeat(121) }), 400, 'long name');
  },

  'validateLegacyCreate lowercases type': () => {
    assert.deepEqual(validateLegacyCreate({ type: 'Watchlist', title: 'My Watchlist' }), {
      type: 'watchlist',
      title: 'My Watchlist',
    });
  },

  'validateUpdate returns only provided fields': () => {
    assert.deepEqual(validateUpdate({ name: 'New', description: 'd' }), { name: 'New', description: 'd' });
    assert.deepEqual(validateUpdate({ description: 'only desc' }), { description: 'only desc' });
  },

  'validateItem requires valid imdbID': () => {
    expectError(() => validateItem({}), 400, 'missing imdbID');
    expectError(() => validateItem({ imdbID: 'xyz' }), 400, 'bad imdbID');
    const out = validateItem({ imdbID: 'tt0111161', title: 'Shawshank', posterUrl: 'http://x/y.jpg' });
    assert.deepEqual(out, { imdbID: 'tt0111161', title: 'Shawshank', posterUrl: 'http://x/y.jpg' });
  },

  'validateLegacyItem reads movie snapshot and falls back to Poster': () => {
    const out = validateLegacyItem({ movie: { imdbID: 'tt1375666', title: 'Inception', Poster: 'http://p.jpg' } });
    assert.deepEqual(out, { imdbID: 'tt1375666', title: 'Inception', posterUrl: 'http://p.jpg' });
  },

  'validateLegacyItem rejects non-object movie': () => {
    expectError(() => validateLegacyItem({}), 400, 'missing movie');
  },
};

for (const [name, fn] of Object.entries(tests)) {
  await fn();
  console.log(`PASS ${name}`);
}
console.log(`OK ${Object.keys(tests).length} tests passed`);
