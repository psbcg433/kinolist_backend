import mongoose from 'mongoose';

const movieSchema = new mongoose.Schema(
  {
    imdbID: { type: String, required: true, unique: true, index: true },
    // The raw, normalized OMDb payload (Title, Poster, Year, ...). Kept as-is
    // for drop-in legacy-frontend compatibility.
    data: { type: mongoose.Schema.Types.Mixed, default: null },
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Movie = mongoose.model('Movie', movieSchema);
export default Movie;
