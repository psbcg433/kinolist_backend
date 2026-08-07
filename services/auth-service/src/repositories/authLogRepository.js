import AuthLog from '../models/authLog.model.js';

export const authLogRepository = {
  async record({ userId, event, detail = '', ip = '', device = '', correlationId = '' }) {
    try {
      return await AuthLog.create({ userId, event, detail, ip, device, correlationId });
    } catch {
      // Logging must never break the auth flow.
      return null;
    }
  },
};
