/**
 * Migration: create supports table
 * Composite-key join table — one row per (user, issue) pair.
 * DELETE CASCADE on both sides so rows clean up automatically.
 */

exports.up = async function up(pgm) {
  await pgm.db.query(`
    CREATE TABLE supports (
      user_id    UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
      issue_id   UUID        NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, issue_id)
    );

    CREATE INDEX idx_supports_issue ON supports(issue_id);
    CREATE INDEX idx_supports_user  ON supports(user_id);
  `);
}

exports.down = async function down(pgm) {
  await pgm.db.query(`DROP TABLE IF EXISTS supports CASCADE;`);
}
