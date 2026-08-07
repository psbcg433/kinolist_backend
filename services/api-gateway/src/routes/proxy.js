import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildProxy(target, prefix) {
  const strip = new RegExp(`^${escapeRegExp(prefix)}`);
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    timeout: config.upstreamTimeoutMs,
    proxyTimeout: config.upstreamTimeoutMs,
    pathRewrite: (path) => path.replace(strip, '') || '/',
    onProxyReq(proxyReq, req) {
      if (req.id) proxyReq.setHeader('X-Request-Id', req.id);
      // Remove any spoofable identity headers that could have reached us.
      proxyReq.removeHeader('x-user-id');
      proxyReq.removeHeader('x-internal-token');
      proxyReq.removeHeader('x-forwarded-user');
    },
    onProxyRes(proxyRes, req) {
      if (req.id) proxyRes.headers['x-request-id'] = req.id;
    },
    onError(err, req, res) {
      logger.error('upstream_error', {
        requestId: req.id,
        target,
        message: err.message,
      });
      if (res.headersSent) {
        res.end();
        return;
      }
      const status = err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' ? 503 : 502;
      res.status(status).json({
        success: false,
        error: {
          code: 'UPSTREAM_UNAVAILABLE',
          message: 'The requested service is temporarily unavailable',
          details: [],
        },
        requestId: req.id || null,
      });
    },
  });
}

export function proxyRoutes(app) {
  const mappings = [
    ['/api/auth', config.serviceUrls.auth],
    ['/api/user', config.serviceUrls.profile],
    ['/api/playlist', config.serviceUrls.library],
    ['/api/library', config.serviceUrls.library],
    ['/api/movie', config.serviceUrls.movie],
    ['/api/feed', config.serviceUrls.discovery],
    ['/api/search', config.serviceUrls.discovery],
    ['/api/recommend', config.serviceUrls.discovery],
  ];
  for (const [prefix, target] of mappings) {
    app.use(prefix, buildProxy(target, prefix));
  }
}
