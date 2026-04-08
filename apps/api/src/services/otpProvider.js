/**
 * OTP Provider — strategy pattern.
 *
 * Strategy is selected by OTP_PROVIDER env var:
 *   "console"  (default, dev/test) — logs OTP to stdout
 *   "msg91"    (production)        — sends via MSG91 SMS gateway
 *
 * Usage:
 *   import { sendOtp } from './otpProvider.js';
 *   await sendOtp(phone, otp);
 */

// ── Console (dev) ─────────────────────────────────────────────────────────────

async function sendConsole(phone, otp) {
  console.info(`[OTP] ${phone} → ${otp}`);
}

// ── MSG91 (production) ────────────────────────────────────────────────────────

async function sendMsg91(phone, otp) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID || 'PRJSHK';
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authKey || !templateId) {
    throw new Error('MSG91_AUTH_KEY and MSG91_TEMPLATE_ID must be set for production OTP delivery');
  }

  const response = await fetch('https://api.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authkey: authKey },
    body: JSON.stringify({
      template_id: templateId,
      mobile: `91${phone}`,
      authkey: authKey,
      otp,
    }),
  });

  const body = await response.json();
  if (body.type !== 'success') {
    throw new Error(`MSG91 error: ${body.message ?? JSON.stringify(body)}`);
  }
}

// ── Export ─────────────────────────────────────────────────────────────────────

const PROVIDER = process.env.OTP_PROVIDER ?? 'console';

const strategies = {
  console: sendConsole,
  msg91: sendMsg91,
};

if (!strategies[PROVIDER]) {
  throw new Error(`Unknown OTP_PROVIDER: "${PROVIDER}". Valid: console, msg91`);
}

export async function sendOtp(phone, otp) {
  return strategies[PROVIDER](phone, otp);
}
