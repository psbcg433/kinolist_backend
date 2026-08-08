import { authService } from '../services/authService.js';
import {
  validateTwoFactorSetup,
  validateTwoFactorSetupVerify,
  validateTwoFactorReset,
} from '../validators/auth.validator.js';
import { sendSuccess } from '../utils/response.js';

function deviceContext(req) {
  return {
    ip: req.ip || req.socket.remoteAddress || '',
    device: (req.headers['user-agent'] || '').slice(0, 300),
  };
}

export const twoFactorController = {
  async setup(req, res, next) {
    try {
      validateTwoFactorSetup(req.body);
      const result = await authService.twoFactorSetup(
        String(req.auth.user._id),
        req.body.password,
        deviceContext(req)
      );
      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  },

  async setupVerify(req, res, next) {
    try {
      validateTwoFactorSetupVerify(req.body);
      await authService.twoFactorSetupVerify(
        String(req.auth.user._id),
        req.auth.claims.sid,
        req.body.challengeId,
        req.body.code,
        deviceContext(req)
      );
      sendSuccess(req, res, { enabled: true });
    } catch (err) {
      next(err);
    }
  },

  async reset(req, res, next) {
    try {
      validateTwoFactorReset(req.body);
      await authService.twoFactorReset(
        String(req.auth.user._id),
        req.auth.claims.sid,
        req.body.password,
        deviceContext(req)
      );
      sendSuccess(req, res, { enabled: false });
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
