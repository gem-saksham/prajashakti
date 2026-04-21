/**
 * Migration: Create issue_officials join table.
 *
 * An issue can tag multiple officials (many-to-many).
 * tag_type distinguishes primary responsible officials from escalation targets,
 * mentioned officials, or officials who have claimed the issue.
 */

exports.up = async function up(pgm) {
  await pgm.db.query(`
    CREATE TABLE issue_officials (
      issue_id    UUID        NOT NULL REFERENCES issues(id)    ON DELETE CASCADE,
      official_id UUID        NOT NULL REFERENCES officials(id) ON DELETE CASCADE,
      tagged_by   UUID        REFERENCES users(id),
      tag_type    VARCHAR(30) NOT NULL DEFAULT 'primary'
                    CHECK (tag_type IN ('primary', 'escalation', 'mentioned', 'claimed')),
      tagged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (issue_id, official_id)
    )
  `);

  await pgm.db.query(`
    CREATE INDEX idx_issue_officials_official ON issue_officials(official_id);
    CREATE INDEX idx_issue_officials_issue    ON issue_officials(issue_id);
    CREATE INDEX idx_issue_officials_type     ON issue_officials(tag_type);
  `);
};

exports.down = async function down(pgm) {
  await pgm.db.query(`DROP TABLE IF EXISTS issue_officials CASCADE`);
};
