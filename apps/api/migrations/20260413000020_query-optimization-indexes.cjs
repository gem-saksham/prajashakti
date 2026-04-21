/**
 * Migration: Day 22 Query Optimization Indexes
 *
 * Adds composite indexes for the hottest read paths identified in EXPLAIN ANALYZE:
 *
 * 1. Issue list  — (status, category, created_at) covers the most common
 *    filtered list query: WHERE status = 'active' AND category = ?
 *    ORDER BY created_at DESC LIMIT 20
 *
 * 2. Issue list  — (status, urgency, created_at) for urgency-filtered feeds
 *    (Sprint 3 feed algorithm will use this heavily)
 *
 * 3. Issue list  — (status, district, state, created_at) for geo-filtered feeds
 *    Covers: WHERE status != 'closed' AND district = ? AND state = ?
 *    ORDER BY created_at DESC
 *
 * 4. Supports velocity — (issue_id, created_at) for the 24-hour velocity query
 *    in supportService.getSupportVelocity(). Already exists as idx_supports_issue
 *    but the composite with created_at speeds up the 24h window filter.
 *
 * 5. Issues feed sort — (supporter_count DESC, created_at DESC) for trending
 *    feed: ORDER BY supporter_count DESC, created_at DESC
 */

exports.up = async function up(pgm) {
  // NOTE: CONCURRENTLY omitted — it cannot run inside a transaction block
  // (node-pg-migrate wraps every migration in BEGIN/COMMIT by default).
  // For a zero-downtime production deploy, apply these manually outside a
  // transaction: psql -c "CREATE INDEX CONCURRENTLY ..."
  // The IF NOT EXISTS guard makes re-runs idempotent.

  // ── 1. Issue list: status + category + created_at ───────────────────────────
  await pgm.db.query(`
    CREATE INDEX IF NOT EXISTS idx_issues_status_cat_created
      ON issues (status, category, created_at DESC)
      WHERE status != 'closed'
  `);

  // ── 2. Issue list: status + urgency + created_at ────────────────────────────
  await pgm.db.query(`
    CREATE INDEX IF NOT EXISTS idx_issues_status_urgency_created
      ON issues (status, urgency, created_at DESC)
      WHERE status != 'closed'
  `);

  // ── 3. Issue list: geo-filtered (district + state + status + created_at) ────
  await pgm.db.query(`
    CREATE INDEX IF NOT EXISTS idx_issues_district_state_created
      ON issues (district, state, status, created_at DESC)
      WHERE status != 'closed'
  `);

  // ── 4. Supports velocity: (issue_id, created_at) ────────────────────────────
  await pgm.db.query(`
    CREATE INDEX IF NOT EXISTS idx_supports_issue_created
      ON supports (issue_id, created_at DESC)
  `);

  // ── 5. Trending feed sort ────────────────────────────────────────────────────
  await pgm.db.query(`
    CREATE INDEX IF NOT EXISTS idx_issues_supporter_created
      ON issues (supporter_count DESC, created_at DESC)
      WHERE status != 'closed'
  `);
};

exports.down = async function down(pgm) {
  await pgm.db.query(`
    DROP INDEX IF EXISTS idx_issues_status_cat_created;
    DROP INDEX IF EXISTS idx_issues_status_urgency_created;
    DROP INDEX IF EXISTS idx_issues_district_state_created;
    DROP INDEX IF EXISTS idx_supports_issue_created;
    DROP INDEX IF EXISTS idx_issues_supporter_created;
  `);
};
