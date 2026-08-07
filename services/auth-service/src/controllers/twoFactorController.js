import { authService } from '../services/authService.js';
import { validateTwoFactorSetupVerify, validateTwoFactorReset } from '../validators/auth.validator.js';

function deviceContext(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return {
    ip: forwarded ? String(forwarded).split(',')[0].trim() : req.socket.remoteAddress || '',
    device: (req.headers['user-agent'] || '').slice(0, 300),
  };
}

export const twoFactorController = {
  async setup(req, res, next) {
    try {
      const result = await authService.twoFactorSetup(String(req.auth.user._id), deviceContext(req));
      res.status(200).json({ success: true, data: result, meta: {}, qr: result.qr });
    } catch (err) {
      next(err);
    }
  },

  async setupVerify(req, res, next) {
    try {
      validateTwoFactorSetupVerify(req.body);
      await authService.twoFactorSetupVerify(String(req.auth.user._id), req.body.code, deviceContext(req));
      res.status(200).json({ success: true, data: { ok: true }, meta: {} });
    } catch (err) {
      next(err);
    }
  },

  async reset(req, res, next) {
    try {
      validateTwoFactorReset(req.body);
      await authService.twoFactorReset(String(req.auth.user._id), req.body.password, deviceContext(req));
      res.status(200).json({ success: true, data: { ok: true }, meta: {} });
    } catch (err) {
      next(err);
    }
  },

  // Legacy alias for the authenticated 2FA-activation flow: POST /api/auth/2fa/verify
  legacyVerify: (req, res, next) => {
    if (!req.body.code && req.body.token) req.body.code = req.body.token;
    return twoFactorController.setupVerify(req, res, next);
  },
};
