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
import { sendSuccess } from '../utils/response.js';

function deviceContext(req) {
  return {
    ip: req.ip || req.socket.remoteAddress || '',
    device: (req.headers['user-agent'] || '').slice(0, 300),
    correlationId: req.id || null,
  };
}

function authSuccess(req, res, status, { user, accessToken, csrfToken } = {}) {
  const sanitized = user ? sanitizeUser(user) : null;
  return sendSuccess(req, res, {
    ...(sanitized ? { user: sanitized } : {}),
    ...(accessToken ? { accessToken } : {}),
    ...(csrfToken ? { csrfToken } : {}),
  }, { status });
}

function setRefreshCookie(res, refreshToken) {
  // Remove cookies created before the versioned API widened COOKIE_PATH from
  // /api/auth to /api, then set the canonical cookie.
  if (config.cookie.path !== '/api/auth') {
    res.clearCookie(config.cookie.name, { ...clearCookieOptions(), path: '/api/auth' });
  }
  res.cookie(config.cookie.name, refreshToken, refreshCookieOptions());
}

function clearRefreshCookies(res) {
  res.clearCookie(config.cookie.name, clearCookieOptions());
  if (config.cookie.path !== '/api/auth') {
    res.clearCookie(config.cookie.name, { ...clearCookieOptions(), path: '/api/auth' });
  }
}

export const authController = {
  async register(req, res, next) {
    try {
      validateRegister(req.body);
      const { email, password, name } = req.body;
      const result = await authService.register(
        { email, password, name },
        deviceContext(req)
      );
      return sendSuccess(req, res, result, { status: 201 });
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      validateLogin(req.body);
      const result = await authService.login(req.body, deviceContext(req));

      if (result.requiresTwoFactor) {
        return sendSuccess(req, res, {
          requiresTwoFactor: true,
          challengeId: result.challengeId,
          expiresInSeconds: result.expiresInSeconds,
          delivery: result.delivery,
        });
      }

      setRefreshCookie(res, result.credentials.refreshToken);
      return authSuccess(req, res, 200, {
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
      setRefreshCookie(res, credentials.refreshToken);
      return authSuccess(req, res, 200, {
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
      return sendSuccess(req, res, { csrfToken: csrfService.generate(sid) });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req, res, next) {
    try {
      const result = await authService.refresh(req.refreshSession.rawToken, deviceContext(req));
      setRefreshCookie(res, result.refreshToken);
      return sendSuccess(req, res, {
        accessToken: result.accessToken,
        csrfToken: result.csrfToken,
      });
    } catch (err) {
      next(err);
    }
  },

  async me(req, res, next) {
    try {
      const user = await authService.me(req.auth.claims);
      return sendSuccess(req, res, { user });
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
      clearRefreshCookies(res);
      return sendSuccess(req, res, { loggedOut: true });
    } catch (err) {
      next(err);
    }
  },

  async logoutAll(req, res, next) {
    try {
      await authService.logoutAll({ claims: req.auth.claims }, deviceContext(req));
      clearRefreshCookies(res);
      return sendSuccess(req, res, { loggedOut: true, allSessions: true });
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
      clearRefreshCookies(res);
      return sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  },
};
