function text(value) {
  if (value === undefined || value === null || value === '' || value === 'N/A') return null;
  return String(value);
}

function list(value) {
  const normalized = text(value);
  return normalized ? normalized.split(',').map((item) => item.trim()).filter(Boolean) : [];
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
    director: text(movie.Director),
    writers: list(movie.Writer),
    actors: list(movie.Actors),
    plot: text(movie.Plot),
    languages: list(movie.Language),
    countries: list(movie.Country),
    imdbRating: text(movie.imdbRating),
    boxOffice: text(movie.BoxOffice),
  };
}

export function movieSearchDTO(result) {
  const movies = (Array.isArray(result?.Search) ? result.Search : [])
    .map(movieSummaryDTO)
    .filter((movie) => movie?.imdbId && movie?.title);
  const providerTotal = Number.parseInt(String(result?.totalResults || ''), 10);
  return {
    movies,
    total: Number.isFinite(providerTotal) ? providerTotal : movies.length,
  };
}
