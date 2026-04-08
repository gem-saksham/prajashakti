/**
 * Migration: create notifications table
 * Per-user notification inbox. JSONB metadata allows each notification
 * type to carry arbitrary context without schema changes.
 */

exports.up = async function up(pgm) {
  await pgm.db.query(`
    CREATE TABLE notifications (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type       VARCHAR(50) NOT NULL,
      title      VARCHAR(200) NOT NULL,
      body       TEXT,
      action_url TEXT,
      is_read    BOOLEAN     NOT NULL DEFAULT false,
      metadata   JSONB       DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Partial index: only unread rows — most queries filter on is_read = false
    CREATE INDEX idx_notifications_user_unread
      ON notifications(user_id, created_at DESC)
      WHERE is_read = false;
  `);
}

exports.down = async function down(pgm) {
  await pgm.db.query(`DROP TABLE IF EXISTS notifications CASCADE;`);
}
