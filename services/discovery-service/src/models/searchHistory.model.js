import mongoose from 'mongoose';

const queryEntrySchema = new mongoose.Schema(
  {
    q: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const searchHistorySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    queries: { type: [queryEntrySchema], default: [] },
    lastSearched: { type: String, default: '' },
    lastSearchedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const SearchHistory = mongoose.model('SearchHistory', searchHistorySchema);
export default SearchHistory;
