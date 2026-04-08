/**
 * Migration: create issues table
 * Core entity — citizen-filed public issues with location, urgency,
 * escalation tracking, and denormalised counter columns for fast feeds.
 */

exports.up = async function up(pgm) {
  await pgm.db.query(`
    CREATE TABLE issues (
      id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      title             VARCHAR(200) NOT NULL,
      description       TEXT         NOT NULL,
      category          VARCHAR(50)  NOT NULL
                          CHECK (category IN (
                            'Infrastructure', 'Healthcare', 'Education',
                            'Safety', 'Environment', 'Agriculture',
                            'Corruption', 'Other'
                          )),
      urgency           VARCHAR(20)  NOT NULL DEFAULT 'medium'
                          CHECK (urgency IN ('critical', 'high', 'medium', 'low')),
      status            VARCHAR(30)  NOT NULL DEFAULT 'active'
                          CHECK (status IN (
                            'active', 'trending', 'escalated',
                            'responded', 'resolved', 'closed'
                          )),
      location_lat      DECIMAL(10, 8),
      location_lng      DECIMAL(11, 8),
      district          VARCHAR(100),
      state             VARCHAR(100),
      pincode           VARCHAR(6),
      photos            TEXT[]       DEFAULT '{}',
      official_id       UUID         REFERENCES officials(id),
      created_by        UUID         NOT NULL REFERENCES users(id),
      supporter_count   INTEGER      NOT NULL DEFAULT 0,
      comment_count     INTEGER      NOT NULL DEFAULT 0,
      share_count       INTEGER      NOT NULL DEFAULT 0,
      target_supporters INTEGER      DEFAULT 500,
      escalation_level  INTEGER      DEFAULT 0,
      escalated_at      TIMESTAMPTZ,
      resolved_at       TIMESTAMPTZ,
      created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_issues_category        ON issues(category);
    CREATE INDEX idx_issues_status          ON issues(status);
    CREATE INDEX idx_issues_district_state  ON issues(district, state);
    CREATE INDEX idx_issues_created_by      ON issues(created_by);
    CREATE INDEX idx_issues_official        ON issues(official_id);
    CREATE INDEX idx_issues_supporter_count ON issues(supporter_count DESC);
    CREATE INDEX idx_issues_created_at      ON issues(created_at DESC);
    CREATE INDEX idx_issues_urgency         ON issues(urgency);
    CREATE INDEX idx_issues_location        ON issues(location_lat, location_lng);

    CREATE TRIGGER issues_updated_at
      BEFORE UPDATE ON issues
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  `);
}

exports.down = async function down(pgm) {
  await pgm.db.query(`DROP TABLE IF EXISTS issues CASCADE;`);
}
