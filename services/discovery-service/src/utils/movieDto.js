function clean(value) {
  if (value === undefined || value === null || value === '' || value === 'N/A') return null;
  return String(value);
}

export function movieSummaryDTO(movie) {
  if (!movie) return null;
  return {
    imdbId: clean(movie.imdbId ?? movie.imdbID),
    title: clean(movie.title ?? movie.Title),
    year: clean(movie.year ?? movie.Year),
    type: clean(movie.type ?? movie.Type),
    posterUrl: clean(movie.posterUrl ?? movie.Poster),
  };
}

export function uniqueMovieSummaries(movies, limit = 20) {
  const seen = new Set();
  const result = [];
  for (const raw of movies || []) {
    const movie = movieSummaryDTO(raw);
    if (!movie?.imdbId || !movie.title || seen.has(movie.imdbId)) continue;
    seen.add(movie.imdbId);
    result.push(movie);
    if (result.length >= limit) break;
  }
  return result;
}
