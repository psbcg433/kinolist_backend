import { createHmac } from 'node:crypto';
import { config } from '../config/env.js';
import { safeEqual } from '../utils/tokens.js';

function sign(sid) {
  const hmac = createHmac('sha256', config.csrfSecret).update(sid).digest('base64url');
  return `${Buffer.from(sid).toString('base64url')}.${hmac}`;
}

export const csrfService = {
  generate(sid) {
    return sign(String(sid));
  },

  verify(token, sid) {
    if (!token || !sid) return false;
    const expected = sign(String(sid));
    return safeEqual(token, expected);
  },
};
