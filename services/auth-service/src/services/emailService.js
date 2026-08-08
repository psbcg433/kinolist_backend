import nodemailer from 'nodemailer';
import qrcode from 'qrcode';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const auth = config.smtp.user
  ? { user: config.smtp.user, pass: config.smtp.pass }
  : undefined;

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  requireTLS: config.smtp.requireTls,
  auth,
  disableFileAccess: true,
  disableUrlAccess: true,
  tls: config.smtp.rejectUnauthorized ? undefined : { rejectUnauthorized: false },
});

const purposeCopy = {
  login: {
    subject: 'Your KinoList sign-in verification code',
    title: 'Complete your KinoList sign-in',
  },
  setup: {
    subject: 'Confirm KinoList email two-factor authentication',
    title: 'Confirm email two-factor authentication',
  },
};

export function maskEmail(email) {
  const [local = '', domain = ''] = String(email || '').split('@');
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

export const emailService = {
  async verifyConnection() {
    return transporter.verify();
  },

  async sendTwoFactorChallenge({ email, code, purpose, expiresInSeconds }) {
    const copy = purposeCopy[purpose];
    if (!copy) throw new Error('Unsupported two-factor email purpose');

    const qr = await qrcode.toBuffer(String(code), {
      type: 'png',
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 320,
    });
    const minutes = Math.max(1, Math.ceil(expiresInSeconds / 60));

    const result = await transporter.sendMail({
      from: config.smtp.from,
      to: email,
      subject: copy.subject,
      text: `${copy.title}. Scan the attached QR image with a QR scanner and enter the six-digit value it contains. It expires in ${minutes} minutes. If you did not request this, ignore this email.`,
      html: `<!doctype html>
<html><body style="margin:0;background:#0f0f0f;color:#f5f5f5;font-family:Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="520" cellspacing="0" cellpadding="0" style="max-width:520px;background:#181818;border:1px solid #333;border-radius:12px">
      <tr><td style="padding:32px;text-align:center">
        <h1 style="font-size:24px;margin:0 0 16px;color:#fff">${copy.title}</h1>
        <p style="line-height:1.6;color:#ccc">Scan this one-time QR image, then enter the six-digit value on the KinoList verification screen.</p>
        <img src="cid:kinolist-two-factor-code" width="320" height="320" alt="KinoList one-time verification QR code" style="display:block;margin:24px auto;background:#fff;border-radius:8px" />
        <p style="color:#ccc">This code expires in <strong>${minutes} minutes</strong> and can be used only once.</p>
        <p style="font-size:13px;color:#888">If you did not request this verification, you can safely ignore this email.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`,
      attachments: [{
        filename: 'kinolist-verification-qr.png',
        content: qr,
        contentType: 'image/png',
        cid: 'kinolist-two-factor-code',
      }],
    });

    logger.info('two_factor_email_sent', {
      purpose,
      destination: maskEmail(email),
      messageId: result.messageId,
    });
  },
};
