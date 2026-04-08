/**
 * Aadhaar Verification Service — scaffold
 *
 * LEGAL NOTE: This service does NOT store Aadhaar numbers.
 * Storing Aadhaar data without UIDAI AUA/KUA licence violates the
 * Aadhaar Act 2016, UIDAI regulations, and the IT (Amendment) Act 2008.
 * We only store the OUTCOME of verification (is_verified) and the method used.
 *
 * ─── Integration paths (not yet implemented) ────────────────────────────────
 *
 * Option A — Digilocker OAuth (RECOMMENDED):
 *   1. Redirect user to https://api.digitallocker.gov.in/public/oauth2/1/authorize
 *      with client_id, redirect_uri, scope=openid, response_type=code
 *   2. User logs in with their Aadhaar / Digilocker credentials
 *   3. Receive authorization code → exchange for access_token at
 *      https://api.digitallocker.gov.in/public/oauth2/1/token
 *   4. Fetch e-Aadhaar XML via
 *      https://api.digitallocker.gov.in/public/oauth2/1/xml/eaadhaar
 *   5. Parse XML, extract name, DOB, address. DO NOT persist Aadhaar number.
 *   6. Set is_verified=true, verification_method='aadhaar_digilocker'
 *   Reference: https://developer.digitallocker.gov.in
 *
 * Option B — UIDAI Aadhaar OTP (requires AUA licence from UIDAI):
 *   1. Collect user's consent and 12-digit Aadhaar number (in memory only, NOT stored)
 *   2. POST to UIDAI OTP endpoint → OTP sent to Aadhaar-linked mobile
 *   3. User submits OTP → POST to UIDAI Auth endpoint with encrypted OTP
 *   4. On success: set is_verified=true, verification_method='aadhaar_otp'
 *   5. Immediately discard Aadhaar number from memory
 *   Reference: https://uidai.gov.in/ecosystem/authentication-devices-documents/developer-section
 *
 * Option C — Manual (admin only):
 *   Admin manually marks a user as verified after offline identity check.
 *   verification_method='manual'
 *
 * ─── TODO before production ─────────────────────────────────────────────────
 *   [ ] Apply for Digilocker partner access at https://developer.digitallocker.gov.in
 *   [ ] Implement PKCE OAuth flow for Digilocker
 *   [ ] Store DIGILOCKER_CLIENT_ID, DIGILOCKER_CLIENT_SECRET in secrets manager
 *   [ ] Add consent capture UI before initiating verification
 *   [ ] Add audit log table for all verification attempts
 *   [ ] Implement retry / cool-down logic (max 3 attempts per user)
 */

import pool from '../db/postgres.js';

// ─── Mock (dev/test only) ─────────────────────────────────────────────────────

/**
 * Mock verification — sets is_verified=true for the user.
 * Used in development and tests only.
 * In production, this is replaced by the Digilocker OAuth flow.
 */
async function mockVerify(userId) {
  const { rows } = await pool.query(
    `UPDATE users
     SET is_verified = true, verified_at = NOW(), verification_method = 'aadhaar_digilocker'
     WHERE id = $1
     RETURNING id, is_verified, verified_at, verification_method`,
    [userId],
  );
  return rows[0] ?? null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initiate Aadhaar verification for a user.
 *
 * In development (NODE_ENV !== 'production'):
 *   Returns mock success immediately.
 *
 * In production:
 *   TODO: Initiate Digilocker OAuth redirect. For now throws NOT_IMPLEMENTED.
 *
 * @param {string} userId  UUID of the authenticated user
 * @returns {{ status, redirectUrl?, user? }}
 */
export async function initiateVerification(userId) {
  if (process.env.NODE_ENV !== 'production') {
    const result = await mockVerify(userId);
    return { status: 'verified', user: result };
  }

  // ── Production: Digilocker OAuth ──────────────────────────────────────────
  // TODO: Generate PKCE code_verifier + code_challenge, store in Redis with userId
  // TODO: Build Digilocker authorize URL with client_id, redirect_uri, state, code_challenge
  // TODO: Return { status: 'redirect', redirectUrl }
  // TODO: In the OAuth callback route, exchange code → token → fetch eAadhaar → verify

  throw Object.assign(
    new Error('Aadhaar verification not yet configured for production. Contact admin.'),
    { statusCode: 501, code: 'NOT_IMPLEMENTED' },
  );
}

/**
 * Mark a user as manually verified (admin only).
 * Should only be called after rigorous offline identity verification.
 */
export async function manualVerify(userId) {
  const { rows } = await pool.query(
    `UPDATE users
     SET is_verified = true, verified_at = NOW(), verification_method = 'manual'
     WHERE id = $1
     RETURNING id, is_verified, verified_at, verification_method`,
    [userId],
  );
  return rows[0] ?? null;
}
