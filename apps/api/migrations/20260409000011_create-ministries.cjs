/**
 * Migration: create ministries table
 * Top of the government hierarchy — 92 Central Ministries + 29 States + 8 UTs.
 * Part of the CPGRAMS taxonomy foundation for Phase 2 government integration.
 */

exports.up = async function up(pgm) {
  await pgm.db.query(`
    CREATE TABLE ministries (
      id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      code          VARCHAR(20)  UNIQUE NOT NULL,
      name          VARCHAR(200) NOT NULL,
      type          VARCHAR(20)  NOT NULL CHECK (type IN ('central', 'state', 'ut')),
      state_code    VARCHAR(10),
      website       TEXT,
      cpgrams_code  VARCHAR(50),
      is_active     BOOLEAN      NOT NULL DEFAULT true,
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_ministries_type    ON ministries(type);
    CREATE INDEX idx_ministries_state   ON ministries(state_code);
    CREATE INDEX idx_ministries_cpgrams ON ministries(cpgrams_code);

    CREATE TRIGGER ministries_updated_at
      BEFORE UPDATE ON ministries
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  `);
}

exports.down = async function down(pgm) {
  await pgm.db.query(`DROP TABLE IF EXISTS ministries CASCADE;`);
}
