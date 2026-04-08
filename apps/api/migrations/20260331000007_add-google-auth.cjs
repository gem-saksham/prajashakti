/**
 * Migration 007 — Add Google OAuth fields
 *
 * Phone remains NOT NULL (phone is always required for registration).
 * Google Sign-In is a LINK-ONLY flow: users register via phone OTP first,
 * then optionally link a Google account via POST /api/v1/users/link/google.
 */

exports.up = async function up(pgm) {
  await pgm.db.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS google_id    VARCHAR(255) UNIQUE,
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

    CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_users_email     ON users(email)     WHERE email     IS NOT NULL;
  `);
};

exports.down = async function down(pgm) {
  await pgm.db.query(`
    DROP INDEX IF EXISTS idx_users_google_id;
    DROP INDEX IF EXISTS idx_users_email;
    ALTER TABLE users
      DROP COLUMN IF EXISTS google_id,
      DROP COLUMN IF EXISTS email_verified;
  `);
};
