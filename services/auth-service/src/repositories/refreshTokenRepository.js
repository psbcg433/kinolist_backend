import RefreshToken from '../models/refreshToken.model.js';

export const refreshTokenRepository = {
  async create({ tokenHash, familyId, sessionId, userId, expiresAt }) {
    return RefreshToken.create({ tokenHash, familyId, sessionId, userId, expiresAt });
  },

  async findByHash(tokenHash) {
    return RefreshToken.findOne({ tokenHash });
  },

  async markRotated(id, replacedByHash) {
    const result = await RefreshToken.updateOne(
      { _id: id, rotatedAt: null, revokedAt: null },
      { $set: { rotatedAt: new Date(), replacedByHash } }
    );
    return result.modifiedCount > 0;
  },

  async revokeByFamily(familyId, reason) {
    const now = new Date();
    return RefreshToken.updateMany(
      { familyId, revokedAt: null },
      { $set: { revokedAt: now, revokeReason: reason } }
    );
  },

  async revokeBySession(sessionId, reason) {
    const now = new Date();
    return RefreshToken.updateMany(
      { sessionId, revokedAt: null },
      { $set: { revokedAt: now, revokeReason: reason } }
    );
  },

  async revokeAllForUser(userId, reason) {
    const now = new Date();
    return RefreshToken.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: now, revokeReason: reason } }
    );
  },

  async revokeAllExceptSession(userId, sessionId, reason) {
    const now = new Date();
    return RefreshToken.updateMany(
      { userId, sessionId: { $ne: sessionId }, revokedAt: null },
      { $set: { revokedAt: now, revokeReason: reason } }
    );
  },
};
