/**
 * Migration: recreate issues table with CPGRAMS taxonomy integration
 *
 * Sprint 2 upgrade — drops the Sprint 1 prototype issues table and replaces
 * it with the full schema that includes:
 *   - Government taxonomy links (ministry, department, grievance category)
 *   - Official tagging (free-text for now, structured later)
 *   - Enhanced status states
 *   - Campaign fields
 *   - Phase 2 bridge: tracking_ids JSONB
 *   - View count, resolution tracking, discrepancy scoring
 *
 * ─── tracking_ids JSONB structure (Phase 2) ────────────────────────────────
 * {
 *   "cpgrams_id":          "DARPG/E/2026/0001234",
 *   "cpgrams_filed_at":    "2026-05-15T10:30:00Z",
 *   "cpgrams_last_status": "under_examination",
 *   "state_portal_id":     "HRYCMW/2026/00567",
 *   "state_portal_type":   "haryana_cm_window",
 *   "nch_docket_id":       "NCH/2026/12345",
 *   "rti_registration_id": "RTI/DoPT/2026/00089",
 *   "rti_filed_at":        "2026-06-01T14:00:00Z",
 *   "rti_response_due":    "2026-07-01T14:00:00Z"
 * }
 * ───────────────────────────────────────────────────────────────────────────
 *
 * NOTE: This migration drops supports and comments first (CASCADE),
 *       then recreates them with identical schemas pointing to the new issues table.
 */

exports.up = async function up(pgm) {
  // ── Step 1: Drop dependent tables ──────────────────────────────────────────
  await pgm.db.query(`
    DROP TABLE IF EXISTS comments CASCADE;
    DROP TABLE IF EXISTS supports CASCADE;
    DROP TABLE IF EXISTS issues CASCADE;
  `);

  // ── Step 2: Create the new issues table ────────────────────────────────────
  await pgm.db.query(`
    CREATE TABLE issues (
      id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      title                     VARCHAR(200) NOT NULL CHECK (char_length(title) >= 10),
      description               TEXT         NOT NULL CHECK (char_length(description) <= 2000),

      -- Classification
      category                  VARCHAR(50)  NOT NULL CHECK (category IN (
                                  'Infrastructure', 'Healthcare', 'Education', 'Safety',
                                  'Environment', 'Agriculture', 'Corruption', 'Other'
                                )),
      urgency                   VARCHAR(20)  NOT NULL DEFAULT 'medium'
                                  CHECK (urgency IN ('critical', 'high', 'medium', 'low')),

      -- Government taxonomy (nullable — populated by user or NLP in Phase 2)
      ministry_id               UUID         REFERENCES ministries(id),
      department_id             UUID         REFERENCES departments(id),
      grievance_category_id     UUID         REFERENCES grievance_categories(id),

      -- Official tagging (free-text for now, structured later)
      official_name             VARCHAR(200),
      official_designation      VARCHAR(200),
      official_department       VARCHAR(200),

      -- Location
      location_lat              DECIMAL(10, 8) NOT NULL,
      location_lng              DECIMAL(11, 8) NOT NULL,
      district                  VARCHAR(100),
      state                     VARCHAR(100),
      pincode                   VARCHAR(6),
      formatted_address         TEXT,

      -- Media
      photos                    JSONB        DEFAULT '[]',

      -- Status
      status                    VARCHAR(30)  NOT NULL DEFAULT 'active'
                                  CHECK (status IN (
                                    'active', 'trending', 'escalated', 'officially_resolved',
                                    'citizen_verified_resolved', 'citizen_disputed', 'closed'
                                  )),

      -- Metrics (denormalized for performance)
      supporter_count           INTEGER      NOT NULL DEFAULT 0,
      comment_count             INTEGER      NOT NULL DEFAULT 0,
      share_count               INTEGER      NOT NULL DEFAULT 0,
      view_count                INTEGER      NOT NULL DEFAULT 0,

      -- Campaign fields (nullable — populated if upgraded in Phase 2)
      is_campaign               BOOLEAN      NOT NULL DEFAULT false,
      target_supporters         INTEGER,
      campaign_deadline         TIMESTAMPTZ,
      escalation_level          INTEGER      NOT NULL DEFAULT 0,
      escalated_at              TIMESTAMPTZ,

      -- Phase 2 bridge: external tracking IDs
      tracking_ids              JSONB        NOT NULL DEFAULT '{}',

      -- Resolution
      resolved_at               TIMESTAMPTZ,
      resolution_notes          TEXT,
      discrepancy_score         DECIMAL(5, 2),

      -- Ownership
      created_by                UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,

      -- Flags
      is_anonymous              BOOLEAN      NOT NULL DEFAULT false,
      is_verified_location      BOOLEAN      NOT NULL DEFAULT false,

      -- Timestamps
      created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `);

  // ── Step 3: Core indexes for feed queries ──────────────────────────────────
  await pgm.db.query(`
    CREATE INDEX idx_issues_status           ON issues(status) WHERE status != 'closed';
    CREATE INDEX idx_issues_category         ON issues(category);
    CREATE INDEX idx_issues_urgency          ON issues(urgency);
    CREATE INDEX idx_issues_district_state   ON issues(district, state);
    CREATE INDEX idx_issues_created_by       ON issues(created_by);
    CREATE INDEX idx_issues_created_at       ON issues(created_at DESC);
    CREATE INDEX idx_issues_supporter_count  ON issues(supporter_count DESC);
    CREATE INDEX idx_issues_is_campaign      ON issues(is_campaign) WHERE is_campaign = true;
  `);

  // ── Step 4: Government taxonomy indexes ────────────────────────────────────
  await pgm.db.query(`
    CREATE INDEX idx_issues_ministry      ON issues(ministry_id)           WHERE ministry_id IS NOT NULL;
    CREATE INDEX idx_issues_department    ON issues(department_id)          WHERE department_id IS NOT NULL;
    CREATE INDEX idx_issues_grievance_cat ON issues(grievance_category_id)  WHERE grievance_category_id IS NOT NULL;
  `);

  // ── Step 5: Phase 2 tracking IDs GIN index ─────────────────────────────────
  await pgm.db.query(`
    CREATE INDEX idx_issues_tracking_ids ON issues USING gin(tracking_ids);
  `);

  // ── Step 6: Geo index for nearby queries ───────────────────────────────────
  await pgm.db.query(`
    CREATE INDEX idx_issues_location ON issues(location_lat, location_lng);
  `);

  // ── Step 7: Trigger for updated_at ─────────────────────────────────────────
  await pgm.db.query(`
    CREATE TRIGGER issues_updated_at
      BEFORE UPDATE ON issues
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  `);

  // ── Step 8: Recreate supports table ────────────────────────────────────────
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

  // ── Step 9: Recreate comments table ────────────────────────────────────────
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
  // Drop the Sprint 2 versions
  await pgm.db.query(`
    DROP TABLE IF EXISTS comments CASCADE;
    DROP TABLE IF EXISTS supports CASCADE;
    DROP TABLE IF EXISTS issues CASCADE;
  `);

  // Restore the Sprint 1 issues table
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

  // Restore Sprint 1 supports
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

  // Restore Sprint 1 comments
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
