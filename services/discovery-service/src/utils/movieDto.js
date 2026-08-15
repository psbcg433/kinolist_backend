function clean(value) {
  if (value === undefined || value === null || value === '' || value === 'N/A') return null;
  return String(value);
}

function cleanList(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  const normalized = clean(value);
  return normalized ? normalized.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

export function movieSummaryDTO(movie) {
  if (!movie) return null;
  const summary = {
    imdbId: clean(movie.imdbId ?? movie.imdbID),
    title: clean(movie.title ?? movie.Title),
    year: clean(movie.year ?? movie.Year),
    type: clean(movie.type ?? movie.Type),
    posterUrl: clean(movie.posterUrl ?? movie.Poster),
  };

  const runtime = clean(movie.runtime ?? movie.Runtime);
  const genres = cleanList(movie.genres ?? movie.Genre);
  const contentRating = clean(movie.contentRating ?? movie.Rated);
  const releaseDate = clean(movie.releaseDate ?? movie.Released);
  const plot = clean(movie.plot ?? movie.Plot);
  const imdbRating = clean(movie.imdbRating);
  const imdbVotes = clean(movie.imdbVotes);
  const metascore = clean(movie.metascore ?? movie.Metascore);

  return {
    ...summary,
    ...(runtime ? { runtime } : {}),
    ...(genres.length ? { genres } : {}),
    ...(contentRating ? { contentRating } : {}),
    ...(releaseDate ? { releaseDate } : {}),
    ...(plot ? { plot } : {}),
    ...(imdbRating ? { imdbRating } : {}),
    ...(imdbVotes ? { imdbVotes } : {}),
    ...(metascore ? { metascore } : {}),
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
