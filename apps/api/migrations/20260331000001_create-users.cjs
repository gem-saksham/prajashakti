/**
 * Migration: create users table
 * Creates the core users table with role-based access, reputation scoring,
 * location fields, and an auto-updating updated_at trigger function reused
 * by all subsequent tables.
 */

exports.up = async function up(pgm) {
  await pgm.db.query(`
    CREATE TABLE users (
      id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      phone            VARCHAR(10)  UNIQUE NOT NULL,
      name             VARCHAR(100) NOT NULL,
      email            VARCHAR(255) UNIQUE,
      bio              VARCHAR(500),
      avatar_url       TEXT,
      location_lat     DECIMAL(10, 8),
      location_lng     DECIMAL(11, 8),
      district         VARCHAR(100),
      state            VARCHAR(100),
      pincode          VARCHAR(6),
      role             VARCHAR(20)  NOT NULL DEFAULT 'citizen'
                         CHECK (role IN ('citizen', 'verified_citizen', 'leader', 'moderator', 'official', 'admin')),
      reputation_score INTEGER      NOT NULL DEFAULT 0,
      is_active        BOOLEAN      NOT NULL DEFAULT true,
      last_login_at    TIMESTAMPTZ,
      created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_users_phone          ON users(phone);
    CREATE INDEX idx_users_district_state ON users(district, state);
    CREATE INDEX idx_users_role           ON users(role);
    CREATE INDEX idx_users_reputation     ON users(reputation_score DESC);

    -- Shared trigger function reused by all tables that have updated_at
    CREATE OR REPLACE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  `);
}

exports.down = async function down(pgm) {
  await pgm.db.query(`
    DROP TABLE IF EXISTS users CASCADE;
    DROP FUNCTION IF EXISTS update_updated_at CASCADE;
  `);
}
