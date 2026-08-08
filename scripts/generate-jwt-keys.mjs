#!/usr/bin/env node
/**
 * Generates an RS256 key pair for KinoList access-token signing.
 *
 * Usage:
 *   node scripts/generate-jwt-keys.mjs
 *
 * Prints .env-ready lines. Paste the values into your root .env and into
 * each service's .env as documented. Never commit these keys.
 */

import { generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// dotenv expands `\n` inside double-quoted values back into real newlines.
// Keep the PEM armor because jsonwebtoken/OpenSSL require a complete PEM key,
// not the unlabelled base64 body.
const toEnvValue = (pem) => pem.trimEnd().replace(/\r?\n/g, '\\n');

console.log(`JWT_ALGORITHM=RS256`);
console.log(`JWT_ACCESS_PRIVATE_KEY="${toEnvValue(privateKey)}"`);
console.log(`JWT_ACCESS_PUBLIC_KEY="${toEnvValue(publicKey)}"`);
