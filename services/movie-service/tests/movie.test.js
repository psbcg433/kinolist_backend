import assert from 'node:assert/strict';
import { validateImdbID, validateBatchIds, validateSearchQuery } from '../src/validators/movie.validator.js';
import { ApiError } from '../src/utils/ApiError.js';
import { movieDetailDTO, movieSearchDTO } from '../src/utils/movieDto.js';

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

  'movie DTO whitelists and normalizes provider data': () => {
    assert.deepEqual(movieDetailDTO({
      imdbID: 'tt1375666',
      Title: 'Inception',
      Year: '2010',
      Type: 'movie',
      Poster: 'https://poster',
      Runtime: '148 min',
      Genre: 'Action, Sci-Fi',
      Director: 'Christopher Nolan',
      Writer: 'Christopher Nolan',
      Actors: 'Leonardo DiCaprio, Joseph Gordon-Levitt',
      Plot: 'A dream heist.',
      Language: 'English, Japanese',
      Country: 'United States, United Kingdom',
      imdbRating: '8.8',
      BoxOffice: '$292,587,330',
      Ratings: [{ Source: 'secret-provider-shape' }],
      Response: 'True',
      Website: 'https://unused',
    }), {
      imdbId: 'tt1375666',
      title: 'Inception',
      year: '2010',
      type: 'movie',
      posterUrl: 'https://poster',
      runtime: '148 min',
      genres: ['Action', 'Sci-Fi'],
      director: 'Christopher Nolan',
      writers: ['Christopher Nolan'],
      actors: ['Leonardo DiCaprio', 'Joseph Gordon-Levitt'],
      plot: 'A dream heist.',
      languages: ['English', 'Japanese'],
      countries: ['United States', 'United Kingdom'],
      imdbRating: '8.8',
      boxOffice: '$292,587,330',
    });
  },

  'movie search DTO removes provider response flags': () => {
    assert.deepEqual(movieSearchDTO({
      Search: [{ imdbID: 'tt1375666', Title: 'Inception', Year: '2010', Type: 'movie', Poster: 'N/A' }],
      totalResults: '1',
      Response: 'True',
    }), {
      movies: [{ imdbId: 'tt1375666', title: 'Inception', year: '2010', type: 'movie', posterUrl: null }],
      total: 1,
    });
  },
};

for (const [name, fn] of Object.entries(tests)) {
  await fn();
  console.log(`PASS ${name}`);
}
console.log(`OK ${Object.keys(tests).length} tests passed`);
