import Session from '../models/session.model.js';

export const sessionRepository = {
  async create({ userId, tokenFamilyId, device, ip, expiresAt }) {
    return Session.create({ userId, tokenFamilyId, device, ip, expiresAt });
  },

  async findById(id) {
    return Session.findById(id);
  },

  async listActiveByUser(userId) {
    return Session.find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } })
      .sort({ lastSeenAt: -1 })
      .lean();
  },

  async revokeById(id, reason) {
    const now = new Date();
    return Session.updateOne(
      { _id: id, revokedAt: null },
      { $set: { revokedAt: now, revokeReason: reason } }
    );
  },

  async revokeAllForUser(userId, reason) {
    const now = new Date();
    return Session.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: now, revokeReason: reason } }
    );
  },

  async touch(id) {
    return Session.updateOne({ _id: id }, { $set: { lastSeenAt: new Date() } });
  },
};
