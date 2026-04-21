/**
 * Migration: Harden the supports table + add suspicious_activity table.
 *
 * The Day 4 supports table is minimal (user_id, issue_id, created_at).
 * Today we:
 *   1. ALTER supports to add weight, source, ip_hash, user_agent_hash
 *      using ADD COLUMN IF NOT EXISTS — safe to run on an already-seeded DB.
 *   2. Replace the plain indexes with composite ones (issue_id, created_at DESC).
 *   3. Create suspicious_activity for the anti-gaming layer.
 */

exports.up = async function up(pgm) {
  // ── 1. Harden supports ────────────────────────────────────────────────────
  await pgm.db.query(`
    ALTER TABLE supports
      ADD COLUMN IF NOT EXISTS weight           DECIMAL(3, 2) NOT NULL DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS source           VARCHAR(20)   NOT NULL DEFAULT 'web'
                                                  CHECK (source IN ('web', 'mobile', 'api', 'imported')),
      ADD COLUMN IF NOT EXISTS ip_hash          VARCHAR(64),
      ADD COLUMN IF NOT EXISTS user_agent_hash  VARCHAR(64)
  `);

  // Drop old simple indexes, recreate as composite with ordering
  await pgm.db.query(`DROP INDEX IF EXISTS idx_supports_issue`);
  await pgm.db.query(`DROP INDEX IF EXISTS idx_supports_user`);

  await pgm.db.query(`
    CREATE INDEX IF NOT EXISTS idx_supports_issue   ON supports(issue_id,  created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_supports_user    ON supports(user_id,   created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_supports_created ON supports(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_supports_ip      ON supports(ip_hash)   WHERE ip_hash IS NOT NULL;
  `);

  // ── 2. suspicious_activity ────────────────────────────────────────────────
  await pgm.db.query(`
    CREATE TABLE IF NOT EXISTS suspicious_activity (
      id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type    VARCHAR(50)  NOT NULL,
      entity_type   VARCHAR(30)  NOT NULL,
      entity_id     UUID         NOT NULL,
      severity      VARCHAR(20)  NOT NULL DEFAULT 'warning'
                      CHECK (severity IN ('info', 'warning', 'critical')),
      details       JSONB        NOT NULL DEFAULT '{}',
      reviewed      BOOLEAN      NOT NULL DEFAULT false,
      reviewed_by   UUID         REFERENCES users(id),
      reviewed_at   TIMESTAMPTZ,
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  await pgm.db.query(`
    CREATE INDEX IF NOT EXISTS idx_suspicious_entity    ON suspicious_activity(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_suspicious_reviewed  ON suspicious_activity(reviewed) WHERE reviewed = false;
    CREATE INDEX IF NOT EXISTS idx_suspicious_created   ON suspicious_activity(created_at DESC);
  `);
};

exports.down = async function down(pgm) {
  await pgm.db.query(`DROP TABLE IF EXISTS suspicious_activity CASCADE`);
  await pgm.db.query(`
    ALTER TABLE supports
      DROP COLUMN IF EXISTS weight,
      DROP COLUMN IF EXISTS source,
      DROP COLUMN IF EXISTS ip_hash,
      DROP COLUMN IF EXISTS user_agent_hash
  `);
  await pgm.db.query(`DROP INDEX IF EXISTS idx_supports_issue`);
  await pgm.db.query(`DROP INDEX IF EXISTS idx_supports_user`);
  await pgm.db.query(`DROP INDEX IF EXISTS idx_supports_created`);
  await pgm.db.query(`DROP INDEX IF EXISTS idx_supports_ip`);
  await pgm.db.query(`
    CREATE INDEX idx_supports_issue ON supports(issue_id);
    CREATE INDEX idx_supports_user  ON supports(user_id);
  `);
};
