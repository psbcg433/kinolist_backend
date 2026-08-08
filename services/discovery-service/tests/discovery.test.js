import assert from 'node:assert/strict';
import { validateSearchQuery, validateGenre, validateUserId } from '../src/validators/discovery.validator.js';
import { tasteDiveSimilar } from '../src/providers/tasteDiveProvider.js';
import { ApiError } from '../src/utils/ApiError.js';
import { consumeDiscoveryEvents, parseStreamEntry } from '../src/events/consumers/discoveryConsumer.js';
import { searchHistoryRepository } from '../src/repositories/searchHistoryRepository.js';
import SearchHistory from '../src/models/searchHistory.model.js';
import { aiRateLimit } from '../src/middleware/aiRateLimit.js';
import { uniqueMovieSummaries } from '../src/utils/movieDto.js';

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
      assert.deepEqual(out.similar.results[0], { name: 'Inception', type: 'movie' });
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

  'search history uses one conflict-free atomic update pipeline': async () => {
    const originalFindOneAndUpdate = SearchHistory.findOneAndUpdate;
    let captured;
    SearchHistory.findOneAndUpdate = (...args) => {
      captured = args;
      return { lean: async () => ({ userId: 'u1' }) };
    };

    try {
      await searchHistoryRepository.record('u1', 'inception', { cap: 5 });
      const [filter, update, options] = captured;
      assert.deepEqual(filter, { userId: 'u1' });
      assert.ok(Array.isArray(update), 'uses an aggregation update pipeline');
      assert.equal(update.length, 1);
      assert.equal(update[0].$set.lastSearched, 'inception');
      assert.equal(update[0].$set.queries.$slice[1], -5);
      assert.deepEqual(options, { upsert: true, new: true });
    } finally {
      SearchHistory.findOneAndUpdate = originalFindOneAndUpdate;
    }
  },

  'AI rate limiter rejects anonymous callers before provider access': async () => {
    let received;
    await aiRateLimit()({ auth: null }, { setHeader() {} }, (err) => { received = err; });
    assert.ok(received instanceof ApiError);
    assert.equal(received.status, 401);
    assert.equal(received.code, 'UNAUTHENTICATED');
  },

  'movie summaries remove provider-specific fields and duplicates': () => {
    assert.deepEqual(uniqueMovieSummaries([
      { imdbID: 'tt1375666', Title: 'Inception', Year: '2010', Type: 'movie', Poster: 'https://poster', Response: 'True' },
      { imdbId: 'tt1375666', title: 'Duplicate' },
    ]), [{
      imdbId: 'tt1375666',
      title: 'Inception',
      year: '2010',
      type: 'movie',
      posterUrl: 'https://poster',
    }]);
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

    const consumer = await consumeDiscoveryEvents({ redisClient: redis, pollIntervalMs: 1 });
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
