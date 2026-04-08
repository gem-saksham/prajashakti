/**
 * Migration: create comments table
 * Threaded comments on issues. Self-referential parent_id enables replies.
 * Soft-delete via is_deleted keeps thread structure intact.
 */

exports.up = async function up(pgm) {
  await pgm.db.query(`
    CREATE TABLE comments (
      id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      issue_id     UUID        NOT NULL REFERENCES issues(id)   ON DELETE CASCADE,
      user_id      UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
      parent_id    UUID        REFERENCES comments(id)          ON DELETE CASCADE,
      body         TEXT        NOT NULL CHECK (char_length(body) <= 1000),
      upvote_count INTEGER     NOT NULL DEFAULT 0,
      is_deleted   BOOLEAN     NOT NULL DEFAULT false,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_comments_issue  ON comments(issue_id, created_at DESC);
    CREATE INDEX idx_comments_user   ON comments(user_id);
    CREATE INDEX idx_comments_parent ON comments(parent_id);

    CREATE TRIGGER comments_updated_at
      BEFORE UPDATE ON comments
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  `);
}

exports.down = async function down(pgm) {
  await pgm.db.query(`DROP TABLE IF EXISTS comments CASCADE;`);
}
