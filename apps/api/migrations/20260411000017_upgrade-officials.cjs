/**
 * Migration: Upgrade officials table to full Phase 1 schema.
 *
 * Sprint 1 had a basic officials table (free-text fields, simple metrics).
 * Day 20 replaces it with:
 *   - FK links to ministries and departments
 *   - Structured jurisdiction (state_code, district_code)
 *   - Phase 2-ready performance metrics
 *   - pg_trgm GIN index for fuzzy name/designation search
 *   - Claimed-account scaffold for Phase 3
 *
 * The Sprint 1 table had NO incoming FKs in the live schema (the issues.official_id
 * FK was removed by migration 20260409000014) so DROP+RECREATE is safe.
 */

exports.up = async function up(pgm) {
  // ── 0. Enable trigram extension (needed for fuzzy search index) ──────────────
  await pgm.db.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

  // ── 1. Drop Sprint 1 officials table ─────────────────────────────────────────
  await pgm.db.query(`DROP TABLE IF EXISTS officials CASCADE`);

  // ── 2. Create new officials table ────────────────────────────────────────────
  await pgm.db.query(`
    CREATE TABLE officials (
      id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      name                     VARCHAR(200)  NOT NULL,
      designation              VARCHAR(200)  NOT NULL,

      -- Government taxonomy links
      department_id            UUID          REFERENCES departments(id),
      ministry_id              UUID          REFERENCES ministries(id),

      -- Jurisdiction
      jurisdiction_type        VARCHAR(30)   CHECK (jurisdiction_type IN (
                                               'national', 'state', 'district', 'municipal', 'local'
                                             )),
      jurisdiction_code        VARCHAR(50),
      state_code               VARCHAR(10),
      district_code            VARCHAR(20),

      -- Contact (public-record sources only — no personal data)
      public_email             VARCHAR(255),
      public_phone             VARCHAR(20),
      office_address           TEXT,
      twitter_handle           VARCHAR(100),

      -- Performance counters (Phase 2 will populate via pipeline)
      total_issues_tagged      INTEGER       NOT NULL DEFAULT 0,
      total_issues_resolved    INTEGER       NOT NULL DEFAULT 0,
      avg_resolution_days      DECIMAL(6, 2),
      citizen_satisfaction_score DECIMAL(5, 2),
      discrepancy_score        DECIMAL(5, 2),

      -- Official metadata
      cadre                    VARCHAR(50),  -- IAS, IPS, IFS, PCS, etc.
      batch_year               INTEGER,
      source                   VARCHAR(50)   NOT NULL DEFAULT 'manual',
      is_verified              BOOLEAN       NOT NULL DEFAULT false,

      -- Claimed-account link (Phase 3)
      claimed_by_user_id       UUID          REFERENCES users(id),
      claimed_at               TIMESTAMPTZ,

      created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `);

  // ── 3. Indexes ────────────────────────────────────────────────────────────────
  await pgm.db.query(`
    CREATE INDEX idx_officials_department   ON officials(department_id)    WHERE department_id IS NOT NULL;
    CREATE INDEX idx_officials_ministry     ON officials(ministry_id)      WHERE ministry_id IS NOT NULL;
    CREATE INDEX idx_officials_jurisdiction ON officials(state_code, district_code);
    CREATE INDEX idx_officials_designation  ON officials(designation);
    CREATE INDEX idx_officials_name_trgm    ON officials USING gin(name gin_trgm_ops);
    CREATE INDEX idx_officials_desig_trgm   ON officials USING gin(designation gin_trgm_ops);
  `);

  // ── 4. updated_at trigger ─────────────────────────────────────────────────────
  await pgm.db.query(`
    CREATE TRIGGER officials_updated_at
      BEFORE UPDATE ON officials
      FOR EACH ROW EXECUTE FUNCTION update_updated_at()
  `);
};

exports.down = async function down(pgm) {
  await pgm.db.query(`DROP TABLE IF EXISTS officials CASCADE`);
  // Re-create the Sprint 1 version
  await pgm.db.query(`
    CREATE TABLE officials (
      id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
      name             VARCHAR(200)  NOT NULL,
      designation      VARCHAR(200)  NOT NULL,
      department       VARCHAR(200),
      district         VARCHAR(100),
      state            VARCHAR(100),
      phone            VARCHAR(10),
      email            VARCHAR(255),
      office_address   TEXT,
      user_id          UUID          REFERENCES users(id),
      rating           DECIMAL(2,1)  DEFAULT 0.0,
      total_ratings    INTEGER       DEFAULT 0,
      pending_issues   INTEGER       DEFAULT 0,
      resolved_issues  INTEGER       DEFAULT 0,
      response_rate    DECIMAL(5,2)  DEFAULT 0.0,
      created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `);
  await pgm.db.query(`
    CREATE TRIGGER officials_updated_at
      BEFORE UPDATE ON officials
      FOR EACH ROW EXECUTE FUNCTION update_updated_at()
  `);
};
