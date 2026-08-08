import { authService } from '../services/authService.js';
import { sendSuccess } from '../utils/response.js';

function deviceContext(req) {
  return {
    ip: req.ip || req.socket.remoteAddress || '',
    device: (req.headers['user-agent'] || '').slice(0, 300),
  };
}

export const sessionController = {
  async list(req, res, next) {
    try {
      const sessions = await authService.listSessions(req.auth.claims.sub, req.auth.claims.sid);
      sendSuccess(req, res, { sessions });
    } catch (err) {
      next(err);
    }
  },

  async revoke(req, res, next) {
    try {
      await authService.revokeSession(req.auth.claims.sub, req.params.sessionId, deviceContext(req));
      sendSuccess(req, res, { revoked: true, sessionId: req.params.sessionId });
    } catch (err) {
      next(err);
    }
  },
};
