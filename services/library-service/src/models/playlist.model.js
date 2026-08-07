import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema(
  {
    imdbID: { type: String, required: true },
    title: { type: String, default: '' },
    posterUrl: { type: String, default: '' },
  },
  { _id: false, timestamps: true }
);

const playlistSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    type: { type: String, enum: ['favourites', 'watchlist', 'custom'], required: true },
    name: { type: String, default: '', maxlength: 120 },
    description: { type: String, default: '', maxlength: 500 },
    isSystem: { type: Boolean, default: false },
    items: { type: [itemSchema], default: [] },
  },
  { timestamps: true }
);

// One system playlist per user per type.
playlistSchema.index(
  { userId: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: { $ne: 'custom' } } }
);

// Custom playlist names are unique per user (case-insensitive enforced in service).
playlistSchema.index(
  { userId: 1, name: 1 },
  { unique: true, partialFilterExpression: { type: 'custom' } }
);

playlistSchema.index({ 'items.imdbID': 1 });

const Playlist = mongoose.model('Playlist', playlistSchema);
export default Playlist;
