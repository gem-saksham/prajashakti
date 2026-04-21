'use strict';

/**
 * Migration: Issue Stories — ground-reality accounts posted by citizens.
 *
 * issue_stories  — the story posts themselves
 * story_helpful  — deduplication table for "helpful" votes (1 per user per story)
 * issues.story_count — cached counter for feed scoring
 */
exports.up = async (pgm) => {
  // ── issue_stories ──────────────────────────────────────────────────────────
  await pgm.db.query(`
    CREATE TABLE issue_stories (
      id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      issue_id       UUID        NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      author_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
      is_anonymous   BOOLEAN     NOT NULL DEFAULT false,
      content        TEXT        NOT NULL,
      photos         JSONB       NOT NULL DEFAULT '[]',
      helpful_count  INTEGER     NOT NULL DEFAULT 0,
      status         VARCHAR(20) NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active', 'hidden', 'removed')),
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_stories_issue_id  ON issue_stories(issue_id, created_at DESC);
    CREATE INDEX idx_stories_author_id ON issue_stories(author_id);
    CREATE INDEX idx_stories_status    ON issue_stories(status);
  `);

  // ── story_helpful (1 vote per user per story) ──────────────────────────────
  await pgm.db.query(`
    CREATE TABLE story_helpful (
      story_id   UUID        NOT NULL REFERENCES issue_stories(id) ON DELETE CASCADE,
      user_id    UUID        NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (story_id, user_id)
    );
  `);

  // ── story_count counter on issues ──────────────────────────────────────────
  await pgm.db.query(`
    ALTER TABLE issues ADD COLUMN story_count INTEGER NOT NULL DEFAULT 0;
  `);
};

exports.down = async (pgm) => {
  await pgm.db.query(`ALTER TABLE issues DROP COLUMN IF EXISTS story_count`);
  await pgm.db.query(`DROP TABLE IF EXISTS story_helpful CASCADE`);
  await pgm.db.query(`DROP TABLE IF EXISTS issue_stories CASCADE`);
};
