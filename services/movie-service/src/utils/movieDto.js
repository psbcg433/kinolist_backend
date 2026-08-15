function text(value) {
  if (value === undefined || value === null || value === '' || value === 'N/A') return null;
  return String(value);
}

function list(value) {
  const normalized = text(value);
  return normalized ? normalized.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

function ratings(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((rating) => ({
      source: text(rating?.Source),
      value: text(rating?.Value),
    }))
    .filter((rating) => rating.source && rating.value);
}

export function movieSummaryDTO(movie) {
  if (!movie) return null;
  return {
    imdbId: text(movie.imdbID),
    title: text(movie.Title),
    year: text(movie.Year),
    type: text(movie.Type),
    posterUrl: text(movie.Poster),
  };
}

export function movieDetailDTO(movie) {
  if (!movie) return null;
  return {
    ...movieSummaryDTO(movie),
    runtime: text(movie.Runtime),
    genres: list(movie.Genre),
    contentRating: text(movie.Rated),
    releaseDate: text(movie.Released),
    director: text(movie.Director),
    writers: list(movie.Writer),
    actors: list(movie.Actors),
    plot: text(movie.Plot),
    languages: list(movie.Language),
    countries: list(movie.Country),
    awards: text(movie.Awards),
    ratings: ratings(movie.Ratings),
    imdbRating: text(movie.imdbRating),
    imdbVotes: text(movie.imdbVotes),
    metascore: text(movie.Metascore),
    boxOffice: text(movie.BoxOffice),
    totalSeasons: text(movie.totalSeasons),
  };
}

export function movieCardDTO(movie) {
  const detail = movieDetailDTO(movie);
  if (!detail) return null;
  return {
    ...movieSummaryDTO(movie),
    runtime: detail.runtime,
    genres: detail.genres,
    contentRating: detail.contentRating,
    releaseDate: detail.releaseDate,
    plot: detail.plot,
    imdbRating: detail.imdbRating,
    imdbVotes: detail.imdbVotes,
    metascore: detail.metascore,
  };
}

export function movieSearchDTO(result, { page = 1 } = {}) {
  const movies = (Array.isArray(result?.Search) ? result.Search : [])
    .map(movieSummaryDTO)
    .filter((movie) => movie?.imdbId && movie?.title);
  const providerTotal = Number.parseInt(String(result?.totalResults || ''), 10);
  return {
    movies,
    total: Number.isFinite(providerTotal) ? providerTotal : movies.length,
    page,
    pageSize: movies.length,
    totalPages: Number.isFinite(providerTotal) ? Math.ceil(providerTotal / 10) : 1,
  };
}
