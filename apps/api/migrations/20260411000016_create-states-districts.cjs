/**
 * Migration: Create states and districts lookup tables.
 *
 * These tables power:
 *   - Dropdown lists in the issue creation form
 *   - Jurisdiction lookup (which state/district does a GPS coordinate fall in)
 *   - Responsible department routing (Phase 2)
 *   - LGD code bridge for CPGRAMS integration (Phase 2)
 *
 * Source: LGD (Local Government Directory) — public domain data from
 *         lgdirectory.gov.in. Seeded via scripts/seed-locations.js.
 */

exports.up = async function up(pgm) {
  // ── States / Union Territories ────────────────────────────────────────────
  await pgm.db.query(`
    CREATE TABLE IF NOT EXISTS states (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      code        VARCHAR(5)  NOT NULL UNIQUE,   -- e.g. "PB", "DL", "MH"
      name        VARCHAR(100) NOT NULL,
      type        VARCHAR(10)  NOT NULL CHECK (type IN ('state', 'ut')),
      lgd_code    VARCHAR(10),                   -- LGD State code
      is_active   BOOLEAN     NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_states_code ON states(code);
    CREATE INDEX idx_states_type ON states(type);
  `);

  // ── Districts ─────────────────────────────────────────────────────────────
  await pgm.db.query(`
    CREATE TABLE IF NOT EXISTS districts (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      code        VARCHAR(10) NOT NULL,          -- e.g. "PB01", "DL11"
      name        VARCHAR(100) NOT NULL,
      state_id    UUID        NOT NULL REFERENCES states(id),
      lgd_code    VARCHAR(10),                   -- LGD District code
      is_active   BOOLEAN     NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      UNIQUE (state_id, code)
    );

    CREATE INDEX idx_districts_code      ON districts(code);
    CREATE INDEX idx_districts_state_id  ON districts(state_id);
    CREATE INDEX idx_districts_name      ON districts USING GIN(to_tsvector('english', name));
  `);
};

exports.down = async function down(pgm) {
  await pgm.db.query('DROP TABLE IF EXISTS districts CASCADE');
  await pgm.db.query('DROP TABLE IF EXISTS states CASCADE');
};
