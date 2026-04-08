/**
 * Migration 008 — Aadhaar verification scaffold
 *
 * IMPORTANT: We do NOT store Aadhaar numbers. Storing Aadhaar without UIDAI
 * AUA/KUA licence is illegal under the Aadhaar Act 2016 and UIDAI regulations.
 * We only store the verification outcome (is_verified) and the method used.
 *
 * Verification methods:
 *   aadhaar_digilocker — OAuth flow via Digilocker (preferred, no Aadhaar sharing)
 *   aadhaar_otp        — OTP to Aadhaar-linked mobile via UIDAI API (requires AUA)
 *   manual             — Offline verification by a moderator (admin use only)
 *
 * Role promotion rule: a user must have is_verified = true before their role
 * can be promoted to 'leader' or above. Enforced in the service layer.
 */

exports.up = async function up(pgm) {
  await pgm.db.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_verified         BOOLEAN    DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS verified_at         TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS verification_method VARCHAR(20)
        CHECK (verification_method IN ('aadhaar_digilocker', 'aadhaar_otp', 'manual'));
  `);
};

exports.down = async function down(pgm) {
  await pgm.db.query(`
    ALTER TABLE users
      DROP COLUMN IF EXISTS is_verified,
      DROP COLUMN IF EXISTS verified_at,
      DROP COLUMN IF EXISTS verification_method;
  `);
};
