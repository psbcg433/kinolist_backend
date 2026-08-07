import Profile from '../models/profile.model.js';

export const profileRepository = {
  async findByUserId(userId) {
    return Profile.findOne({ userId }).lean();
  },

  /** Idempotent create-or-update used by the registration event consumer. */
  async upsert(userId, fields) {
    return Profile.findOneAndUpdate(
      { userId },
      { $set: fields, $setOnInsert: { userId } },
      { upsert: true, new: true }
    );
  },

  /** Inserts only if absent (registration event replay never clobbers edits). */
  async createIfAbsent(userId, fields) {
    return Profile.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, ...fields } },
      { upsert: true, new: true }
    );
  },

  async update(userId, fields) {
    return Profile.findOneAndUpdate({ userId }, { $set: fields }, { new: true });
  },

  async deleteByUserId(userId) {
    return Profile.findOneAndDelete({ userId });
  },
};
