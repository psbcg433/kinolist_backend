const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const configuredLevel = LEVELS[process.env.LOG_LEVEL || 'info'] ?? 20;

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'refreshToken',
  'accessToken',
  'csrfToken',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'setCookie',
  'totp',
  'twoFASecret',
  'privateKey',
  'challengeId',
]);

function sanitize(input) {
  if (Array.isArray(input)) return input.map(sanitize);
  if (input && typeof input === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(input)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = sanitize(value);
      }
    }
    return out;
  }
  return input;
}

function emit(level, message, fields = {}) {
  if (LEVELS[level] < configuredLevel) return;
  const line = {
    level,
    time: new Date().toISOString(),
    msg: message,
    ...sanitize(fields),
  };
  const output = JSON.stringify(line);
  if (level === 'error') process.stderr.write(output + '\n');
  else process.stdout.write(output + '\n');
}

export const logger = {
  debug: (msg, fields) => emit('debug', msg, fields),
  info: (msg, fields) => emit('info', msg, fields),
  warn: (msg, fields) => emit('warn', msg, fields),
  error: (msg, fields) => emit('error', msg, fields),
  child: () => logger,
};
