import { randomUUID } from 'node:crypto';

export function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const id = incoming && incoming.length <= 64 ? String(incoming) : randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}
