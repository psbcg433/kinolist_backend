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
];

export function stripHopByHopHeaders(req, _res, next) {
  for (const header of HOP_BY_HOP_HEADERS) {
    req.headers[header] = undefined;
  }
  for (const header of SPOOFABLE_HEADERS) {
    req.headers[header] = undefined;
  }
  next();
}

export { SPOOFABLE_HEADERS };
