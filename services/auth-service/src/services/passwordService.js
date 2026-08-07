import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';

export const passwordService = {
  async hash(password) {
    const salt = await bcrypt.genSalt(config.bcryptRounds);
    return bcrypt.hash(password, salt);
  },

  async compare(candidate, hash) {
    return bcrypt.compare(candidate, hash);
  },
};
