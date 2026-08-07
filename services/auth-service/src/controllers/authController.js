import { authService, sanitizeUser } from '../services/authService.js';
import {
  validateRegister,
  validateLogin,
  validateTwoFactorLogin,
  validateDeleteAccount,
} from '../validators/auth.validator.js';
import { refreshCookieOptions, clearCookieOptions } from '../services/cookieService.js';
import { csrfService } from '../services/csrfService.js';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

function deviceContext(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return {
    ip: forwarded ? String(forwarded).split(',')[0].trim() : req.socket.remoteAddress || '',
    device: (req.headers['user-agent'] || '').slice(0, 300),
    correlationId: req.id || null,
  };
}

// Legacy client reads top-level `user`/`token`/`twoFAEnabled` (setCredentials
// expects `{ user, token }`). Mirror those fields alongside the modern
// envelope so both clients keep working without weakening the secure flow.
function authSuccess(res, status, { user, accessToken, csrfToken, requiresTwoFactor = false } = {}) {
  const sanitized = user ? sanitizeUser(user) : null;
  return res.status(status).json({
    success: true,
    data: {
      ...(sanitized ? { user: sanitized } : {}),
      ...(accessToken ? { accessToken } : {}),
      ...(csrfToken ? { csrfToken } : {}),
      ...(requiresTwoFactor ? { requiresTwoFactor: true } : {}),
    },
    meta: {},
    ...(sanitized ? { user: sanitized } : {}),
    ...(accessToken ? { token: accessToken } : {}),
    twoFAEnabled: requiresTwoFactor ? true : !!(sanitized && sanitized.twoFactorEnabled),
  });
}

export const authController = {
  async register(req, res, next) {
    try {
      validateRegister(req.body);
      const { email, password, name } = req.body;
      const { user, credentials } = await authService.register(
        { email, password, name },
        deviceContext(req)
      );
      res.cookie(config.cookie.name, credentials.refreshToken, refreshCookieOptions());
      return authSuccess(res, 201, {
        user,
        accessToken: credentials.accessToken,
        csrfToken: credentials.csrfToken,
      });
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      validateLogin(req.body);
      const result = await authService.login(req.body, deviceContext(req));

      if (result.requiresTwoFactor) {
        return res.status(200).json({
          success: true,
          data: {
            requiresTwoFactor: true,
            challengeId: result.challengeId,
            user: result.user,
          },
          meta: {},
          user: result.user,
          twoFAEnabled: true,
        });
      }

      res.cookie(config.cookie.name, result.credentials.refreshToken, refreshCookieOptions());
      return authSuccess(res, 200, {
        user: result.credentials.user,
        accessToken: result.credentials.accessToken,
        csrfToken: result.credentials.csrfToken,
      });
    } catch (err) {
      next(err);
    }
  },

  async twoFactorLoginVerify(req, res, next) {
    try {
      validateTwoFactorLogin(req.body);
      const { challengeId, code } = req.body;
      const { credentials } = await authService.verifyTwoFactorLogin(
        { challengeId, code },
        deviceContext(req)
      );
      res.cookie(config.cookie.name, credentials.refreshToken, refreshCookieOptions());
      return authSuccess(res, 200, {
        user: credentials.user,
        accessToken: credentials.accessToken,
        csrfToken: credentials.csrfToken,
      });
    } catch (err) {
      next(err);
    }
  },

  async csrf(req, res, next) {
    try {
      // requireRefreshCookie already validated the cookie; attach the sid.
      const sid = req.refreshSession.sid;
      return res.status(200).json({
        success: true,
        data: { csrfToken: csrfService.generate(sid) },
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req, res, next) {
    try {
      const result = await authService.refresh(req.refreshSession.rawToken, deviceContext(req));
      res.cookie(config.cookie.name, result.refreshToken, refreshCookieOptions());
      return res.status(200).json({
        success: true,
        data: { accessToken: result.accessToken, csrfToken: result.csrfToken },
        meta: {},
      });
    } catch (err) {
      next(err);
    }
  },

  async me(req, res, next) {
    try {
      const user = await authService.me(req.auth.claims);
      const sanitized = sanitizeUser(user);
      return res.status(200).json({
        success: true,
        data: { user: sanitized },
        meta: {},
        user: sanitized,
      });
    } catch (err) {
      next(err);
    }
  },

  async logout(req, res, next) {
    try {
      const ctx = deviceContext(req);
      if (req.auth) {
        await authService.logout({ claims: req.auth.claims }, ctx);
      } else if (req.refreshSession) {
        await authService.logout({ refreshCookie: req.refreshSession.rawToken }, ctx);
      } else {
        throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required to log out');
      }
      res.clearCookie(config.cookie.name, clearCookieOptions());
      return res.status(200).json({ success: true, data: { ok: true }, meta: {} });
    } catch (err) {
      next(err);
    }
  },

  async logoutAll(req, res, next) {
    try {
      await authService.logoutAll({ claims: req.auth.claims }, deviceContext(req));
      res.clearCookie(config.cookie.name, clearCookieOptions());
      return res.status(200).json({ success: true, data: { ok: true }, meta: {} });
    } catch (err) {
      next(err);
    }
  },

  async deleteAccount(req, res, next) {
    try {
      validateDeleteAccount(req.body);
      const result = await authService.deleteAccount(
        req.auth.claims.sub,
        req.body.password,
        deviceContext(req)
      );
      res.clearCookie(config.cookie.name, clearCookieOptions());
      return res.status(200).json({ success: true, data: result, meta: {} });
    } catch (err) {
      next(err);
    }
  },
};
