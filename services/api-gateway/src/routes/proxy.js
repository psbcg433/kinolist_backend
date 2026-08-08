import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export function upstreamPath(prefix, path, { stripPrefix = false } = {}) {
  // Express removes an app.use() mount path from req.url before the proxy
  // middleware sees it. Auth is intentionally mounted at `/` upstream, while
  // every other service retains its public `/api/...` mount path.
  if (stripPrefix) return path || '/';
  const suffix = path && path.startsWith('/') ? path : `/${path || ''}`;
  return `${prefix}${suffix}`;
}

export function buildProxy(target, prefix, { stripPrefix = false } = {}) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    timeout: config.upstreamTimeoutMs,
    proxyTimeout: config.upstreamTimeoutMs,
    pathRewrite: (path) => upstreamPath(prefix, path, { stripPrefix }),
    onProxyReq(proxyReq, req) {
      if (req.id) proxyReq.setHeader('X-Request-Id', req.id);
      // Remove any spoofable identity headers that could have reached us.
      proxyReq.removeHeader('x-user-id');
      proxyReq.removeHeader('x-internal-token');
      proxyReq.removeHeader('x-internal-key');
      proxyReq.removeHeader('x-forwarded-user');
      proxyReq.removeHeader('x-forwarded-for');
      proxyReq.removeHeader('x-forwarded-host');
      proxyReq.removeHeader('x-forwarded-port');
      proxyReq.removeHeader('x-forwarded-proto');
      if (req.clientIp) proxyReq.setHeader('X-Forwarded-For', req.clientIp);
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
    ['/api/v1/auth', config.serviceUrls.auth, { stripPrefix: true, upstreamPrefix: '/api/auth' }],
    ['/api/v1/user', config.serviceUrls.profile, { upstreamPrefix: '/api/user' }],
    ['/api/v1/playlist', config.serviceUrls.library, { upstreamPrefix: '/api/playlist' }],
    ['/api/v1/library', config.serviceUrls.library, { upstreamPrefix: '/api/library' }],
    ['/api/v1/movie', config.serviceUrls.movie, { upstreamPrefix: '/api/movie' }],
    ['/api/v1/feed', config.serviceUrls.discovery, { upstreamPrefix: '/api/feed' }],
    ['/api/v1/search', config.serviceUrls.discovery, { upstreamPrefix: '/api/search' }],
    ['/api/v1/recommend', config.serviceUrls.discovery, { upstreamPrefix: '/api/recommend' }],
    ['/api/auth', config.serviceUrls.auth, { stripPrefix: true, upstreamPrefix: '/api/auth' }],
    ['/api/user', config.serviceUrls.profile, { upstreamPrefix: '/api/user' }],
    ['/api/playlist', config.serviceUrls.library, { upstreamPrefix: '/api/playlist' }],
    ['/api/library', config.serviceUrls.library, { upstreamPrefix: '/api/library' }],
    ['/api/movie', config.serviceUrls.movie, { upstreamPrefix: '/api/movie' }],
    ['/api/feed', config.serviceUrls.discovery, { upstreamPrefix: '/api/feed' }],
    ['/api/search', config.serviceUrls.discovery, { upstreamPrefix: '/api/search' }],
    ['/api/recommend', config.serviceUrls.discovery, { upstreamPrefix: '/api/recommend' }],
  ];
  for (const [prefix, target, options] of mappings) {
    app.use(prefix, buildProxy(target, options.upstreamPrefix || prefix, options));
  }
}
