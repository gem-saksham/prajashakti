/**
 * Migration 009 — user_activity table
 *
 * Tracks meaningful user actions for reputation scoring and public profile feeds.
 * Sensitive actions (login, logout) are stored but excluded from public queries.
 *
 * Public actions: issue_created, issue_supported, comment_posted, aadhaar_verified
 * Private actions: login, profile_updated
 */

exports.up = async function up(pgm) {
  await pgm.db.query(`
    CREATE TABLE user_activity (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action      VARCHAR(50) NOT NULL,
      entity_type VARCHAR(30),
      entity_id   UUID,
      metadata    JSONB       NOT NULL DEFAULT '{}',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_activity_user   ON user_activity(user_id, created_at DESC);
    CREATE INDEX idx_activity_action ON user_activity(action);
  `);
};

exports.down = async function down(pgm) {
  await pgm.db.query(`DROP TABLE IF EXISTS user_activity CASCADE;`);
};
