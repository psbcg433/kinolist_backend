// Strips hop-by-hop headers and spoofable internal identity headers from
// browser requests before they are proxied upstream.
const HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
];

const SPOOFABLE_HEADERS = [
  'x-user-id',
  'x-internal-token',
  'x-service-token',
  'x-forwarded-user',
  'x-role',
  'x-internal-key',
];

export function stripHopByHopHeaders(req, _res, next) {
  // Resolve the client IP through Express's explicitly configured trust policy
  // before removing caller-controlled forwarding headers.
  req.clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
  req.hadTransferEncoding = Object.hasOwn(req.headers, 'transfer-encoding');

  for (const header of HOP_BY_HOP_HEADERS) {
    delete req.headers[header];
  }
  for (const header of SPOOFABLE_HEADERS) {
    delete req.headers[header];
  }
  for (const header of ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-port', 'x-forwarded-proto']) {
    delete req.headers[header];
  }
  next();
}

export { SPOOFABLE_HEADERS };
