import { authService } from '../services/authService.js';

function deviceContext(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return {
    ip: forwarded ? String(forwarded).split(',')[0].trim() : req.socket.remoteAddress || '',
    device: (req.headers['user-agent'] || '').slice(0, 300),
  };
}

export const sessionController = {
  async list(req, res, next) {
    try {
      const currentSid = req.auth.claims.sid;
      const sessions = await authService.listSessions(req.auth.claims.sub, currentSid);
      res.status(200).json({ success: true, data: { sessions }, meta: { currentSessionId: currentSid } });
    } catch (err) {
      next(err);
    }
  },

  async revoke(req, res, next) {
    try {
      await authService.revokeSession(req.auth.claims.sub, req.params.sessionId, deviceContext(req));
      res.status(200).json({ success: true, data: { ok: true }, meta: {} });
    } catch (err) {
      next(err);
    }
  },
};
