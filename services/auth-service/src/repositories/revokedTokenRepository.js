import RevokedToken from '../models/revokedToken.model.js';

export const revokedTokenRepository = {
  async create({ jti, userId, sid, expiresAt }) {
    return RevokedToken.create({ jti, userId, sid, expiresAt });
  },
};
