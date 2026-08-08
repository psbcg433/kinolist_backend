import mongoose from 'mongoose';
import User from '../models/user.model.js';

export const userRepository = {
  newId() {
    return new mongoose.Types.ObjectId();
  },

  async findByEmail(email) {
    return User.findOne({ email });
  },

  async findById(id) {
    return User.findById(id);
  },

  async create({ id, email, passwordHash, role = 'USER', pendingEvent = null }) {
    return User.create({
      ...(id ? { _id: id } : {}),
      email,
      passwordHash,
      role,
      pendingEvents: pendingEvent ? [pendingEvent] : [],
    });
  },

  async incrementTokenVersion(userId) {
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { tokenVersion: 1 } },
      { new: true }
    );
    return user;
  },

  async markDeleted(userId, pendingEvent) {
    const user = await User.findByIdAndUpdate(
      { _id: userId, status: 'active' },
      {
        $set: { status: 'deleted' },
        $inc: { tokenVersion: 1 },
        ...(pendingEvent ? { $push: { pendingEvents: pendingEvent } } : {}),
      },
      { new: true }
    );
    return user;
  },

  async listWithPendingEvents({ userId = null, limit = 25 } = {}) {
    const query = { 'pendingEvents.0': { $exists: true } };
    if (userId) query._id = userId;
    return User.find(query)
      .select('_id pendingEvents')
      .limit(limit)
      .lean();
  },

  async acknowledgePendingEvent(userId, eventId) {
    return User.updateOne(
      { _id: userId },
      { $pull: { pendingEvents: { eventId } } }
    );
  },
};
