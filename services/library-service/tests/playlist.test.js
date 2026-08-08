import assert from 'node:assert/strict';
import {
  validateCreate,
  validateLegacyCreate,
  validateUpdate,
  validateItem,
  validateLegacyItem,
} from '../src/validators/playlist.validator.js';
import { ApiError } from '../src/utils/ApiError.js';
import { consumeLibraryEvents, parseStreamEntry } from '../src/events/consumers/libraryConsumer.js';
import { playlistDTO } from '../src/services/playlistService.js';

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

  'deletion events decode from the domain envelope': () => {
    const envelope = {
      eventType: 'USER_DELETED.v1',
      schemaVersion: 1,
      payload: { userId: 'u1' },
    };
    const event = parseStreamEntry(['event', JSON.stringify(envelope)]);
    assert.equal(event.type, 'USER_DELETED.v1');
    assert.equal(event.version, 1);
    assert.deepEqual(event.data, { userId: 'u1' });
  },

  'playlist DTO removes ownership internals and normalizes item identifiers': () => {
    assert.deepEqual(playlistDTO({
      _id: 'playlist-1',
      userId: 'user-1',
      type: 'custom',
      name: 'Weekend',
      description: 'Watch later',
      isSystem: false,
      items: [{ imdbID: 'tt0111161', title: 'Shawshank', posterUrl: 'https://poster' }],
      createdAt: new Date(),
    }), {
      id: 'playlist-1',
      type: 'custom',
      name: 'Weekend',
      description: 'Watch later',
      isSystem: false,
      itemCount: 1,
      items: [{ imdbId: 'tt0111161', title: 'Shawshank', posterUrl: 'https://poster' }],
    });
  },

  'event consumer never overlaps blocking stream reads': async () => {
    let activeReads = 0;
    let maxActiveReads = 0;
    let readCount = 0;
    const redis = {
      xgroup: async () => 'OK',
      xautoclaim: async () => ['0-0', []],
      xreadgroup: async () => {
        activeReads += 1;
        readCount += 1;
        maxActiveReads = Math.max(maxActiveReads, activeReads);
        await new Promise((resolve) => setTimeout(resolve, 5));
        activeReads -= 1;
        return null;
      },
    };

    const consumer = await consumeLibraryEvents({ redisClient: redis, pollIntervalMs: 1 });
    await new Promise((resolve) => setTimeout(resolve, 25));
    await consumer.stop();
    assert.ok(readCount >= 2);
    assert.equal(maxActiveReads, 1);
  },
};

for (const [name, fn] of Object.entries(tests)) {
  await fn();
  console.log(`PASS ${name}`);
}
console.log(`OK ${Object.keys(tests).length} tests passed`);
