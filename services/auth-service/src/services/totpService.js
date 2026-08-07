import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { ApiError } from '../utils/ApiError.js';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';

const APP_NAME = 'KinoList';

export const totpService = {
  generatePendingSecret(email) {
    const generated = speakeasy.generateSecret({
      name: `${APP_NAME}:${email || 'user'}`,
      length: 20,
    });
    return {
      base32: generated.base32,
      otpauthUrl: generated.otpauth_url,
      encrypted: encryptSecret(generated.base32),
    };
  },

  async qrDataUrl(otpauthUrl) {
    return qrcode.toDataURL(otpauthUrl);
  },

  verify(encryptedSecret, code) {
    if (!encryptedSecret) {
      throw new ApiError(400, 'TWO_FA_NOT_SETUP', 'Two-factor authentication is not set up');
    }
    const secret = decryptSecret(encryptedSecret);
    const valid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: String(code).replace(/\s+/g, ''),
      window: 1,
    });
    if (!valid) {
      throw new ApiError(400, 'INVALID_TOTP_CODE', 'The verification code is invalid or has expired');
    }
    return true;
  },
};
