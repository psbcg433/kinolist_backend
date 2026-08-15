import { movieClient } from '../providers/peerClients.js';
import { tasteDiveSimilar } from '../providers/tasteDiveProvider.js';
import { searchHistoryRepository } from '../repositories/searchHistoryRepository.js';
import { config } from '../config/env.js';
import { cached } from './discoveryCache.js';
import { logger } from '../utils/logger.js';
import { movieSummaryDTO, uniqueMovieSummaries } from '../utils/movieDto.js';

const FEED_LIMIT = 20;
const CURRENT_YEAR = () => new Date().getFullYear();

function searchItems(searchResult) {
  return Array.isArray(searchResult?.movies) ? searchResult.movies : [];
}

async function tasteDiveNames(seed, limit = config.limits.maxRecommendResolve) {
  try {
    const result = await tasteDiveSimilar(seed, { limit });
    return (result?.similar?.results || []).map((item) => item.name).filter(Boolean);
  } catch (err) {
    logger.warn('feed_tastedive_failed', { seed, message: err.message });
    return [];
  }
}

async function resolveSeeds(seeds, { perSeed = config.limits.feedResolvePerSeed } = {}) {
  const uniqueSeeds = [...new Set((seeds || []).map((seed) => String(seed).trim()).filter(Boolean))]
    .slice(0, config.limits.maxRecommendResolve);
  const results = await Promise.allSettled(uniqueSeeds.map((seed) => movieClient.search(seed)));
  const movies = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      movies.push(...searchItems(result.value).slice(0, perSeed));
      return;
    }
    logger.warn('feed_seed_resolve_failed', {
      seed: uniqueSeeds[index],
      message: result.reason?.message || 'Unknown error',
    });
  });

  return uniqueMovieSummaries(movies, FEED_LIMIT);
}

async function enrichCards(movies) {
  const summaries = uniqueMovieSummaries(movies, Math.min(config.limits.feedEnrichLimit, 20));
  if (!summaries.length) return [];

  try {
    const detailsById = await movieClient.batch(summaries.map((movie) => movie.imdbId));
    return summaries.map((summary) =>
      movieSummaryDTO({ ...summary, ...(detailsById[summary.imdbId] || {}) })
    );
  } catch (err) {
    logger.warn('feed_enrichment_failed', { message: err.message });
    return summaries;
  }
}

function asResult(movies) {
  const cleaned = uniqueMovieSummaries(movies, FEED_LIMIT);
  return { movies: cleaned, total: cleaned.length };
}

function numericVotes(movie) {
  const votes = Number.parseInt(String(movie?.imdbVotes || '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(votes) ? votes : 0;
}

function numericRating(movie) {
  const rating = Number.parseFloat(String(movie?.imdbRating || ''));
  return Number.isFinite(rating) ? rating : 0;
}

function popularityScore(movie) {
  return numericVotes(movie) * Math.max(numericRating(movie), 1);
}

async function popularSearchSeeds(limit = config.limits.maxRecommendResolve) {
  const since = new Date(Date.now() - config.limits.trendingWindowDays * 24 * 60 * 60 * 1000);
  const rows = await searchHistoryRepository.popularQueries({ since, limit });
  return rows.map((row) => row.query);
}

export const feedService = {
  /** KinoList trending is based on recent aggregate searches, not a fake OMDb year query. */
  async trending() {
    return cached('discovery:cache:v7:feed:trending', config.caches.feedTtl, async () => {
      const popularSeeds = await popularSearchSeeds();
      const fallbackSeeds = popularSeeds.length ? [] : await tasteDiveNames('popular movies');
      const movies = await resolveSeeds(popularSeeds.length ? popularSeeds : fallbackSeeds);
      const enriched = await enrichCards(movies);
      return asResult(enriched.sort((a, b) => popularityScore(b) - popularityScore(a)));
    });
  },

  async byGenre(genre) {
    const key = `discovery:cache:v7:feed:genre:${encodeURIComponent(String(genre).toLowerCase())}`;
    return cached(key, config.caches.feedTtl, async () => {
      const catalogue = await movieClient.catalog({
        genre,
        sort: 'popular',
        limit: config.limits.feedEnrichLimit,
      }).catch(() => ({ movies: [] }));
      if (catalogue.movies.length >= Math.min(6, config.limits.feedEnrichLimit)) {
        return asResult(catalogue.movies);
      }
      const names = await tasteDiveNames(`${genre} movies`);
      const resolved = names.length ? await resolveSeeds(names) : [];
      return asResult(await enrichCards([...catalogue.movies, ...resolved]));
    });
  },

  /** OMDb has no release feed, so resolve provider recommendations and retain recent years. */
  async ongoing() {
    return cached('discovery:cache:v8:feed:ongoing', config.caches.feedTtl, async () => {
      const year = CURRENT_YEAR();
      const catalogue = await movieClient.catalog({
        minYear: year - 1,
        sort: 'recent',
        limit: config.limits.feedEnrichLimit,
      }).catch(() => ({ movies: [] }));
      if (catalogue.movies.length >= Math.min(6, config.limits.feedEnrichLimit)) {
        return asResult(catalogue.movies);
      }
      const names = await tasteDiveNames('new movies');
      const resolved = names.length ? await resolveSeeds(names) : [];
      const enriched = await enrichCards([...catalogue.movies, ...resolved]);
      const recent = enriched.filter((movie) => {
        const releaseYear = Number.parseInt(String(movie.year || '').slice(0, 4), 10);
        return Number.isFinite(releaseYear)
          && releaseYear >= year - 1
          && numericVotes(movie) >= 1000;
      });
      return asResult(recent);
    });
  },

  async discover() {
    return cached('discovery:cache:v7:feed:discover', config.caches.feedTtl, async () => {
      const catalogue = await movieClient.catalog({
        sort: 'popular',
        limit: config.limits.feedEnrichLimit,
      }).catch(() => ({ movies: [] }));
      if (catalogue.movies.length >= config.limits.feedEnrichLimit) {
        return asResult(catalogue.movies);
      }
      const [providerSeeds, searchSeeds] = await Promise.all([
        tasteDiveNames('movies'),
        popularSearchSeeds(Math.max(2, Math.floor(config.limits.maxRecommendResolve / 2))),
      ]);
      const resolved = await resolveSeeds([...providerSeeds, ...searchSeeds]);
      return asResult(await enrichCards([...catalogue.movies, ...resolved]));
    });
  },

  async topRated() {
    return cached('discovery:cache:v7:feed:top-rated', config.caches.feedTtl, async () => {
      const [catalogue, trending, discover, ongoing] = await Promise.all([
        movieClient.catalog({ sort: 'rating', limit: FEED_LIMIT }).catch(() => ({ movies: [] })),
        this.trending(),
        this.discover(),
        this.ongoing(),
      ]);
      const candidates = uniqueMovieSummaries(
        [...catalogue.movies, ...trending.movies, ...discover.movies, ...ongoing.movies],
        FEED_LIMIT * 3
      );
      const credible = candidates.filter((movie) => numericVotes(movie) >= 1000);
      const movies = (credible.length ? credible : candidates).sort((a, b) => {
        const ratingDifference = numericRating(b) - numericRating(a);
        return ratingDifference || numericVotes(b) - numericVotes(a);
      });
      return asResult(movies);
    });
  },
};
