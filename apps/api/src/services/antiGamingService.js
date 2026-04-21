/**
 * Anti-Gaming Service — detect suspicious support patterns.
 *
 * Design principle: NEVER block automatically. Flag and let moderators review.
 * Automated blocking causes false positives that silence real citizens.
 *
 * Checks run asynchronously (fire-and-forget from supportService).
 * All flags land in the suspicious_activity table.
 */

import pool from '../db/postgres.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const VELOCITY_THRESHOLD = 1000; // supports in 10 minutes = suspicious
const IP_CONCENTRATION_THRESHOLD = 0.5; // >50% from same /24 subnet
const UA_CONCENTRATION_THRESHOLD = 0.7; // >70% same user-agent hash
const MIN_SUPPORTS_FOR_ANALYSIS = 20; // don't analyse tiny issues

// ── DB write helper ───────────────────────────────────────────────────────────

async function logFlag(eventType, entityId, severity, details) {
  try {
    await pool.query(
      `INSERT INTO suspicious_activity (event_type, entity_type, entity_id, severity, details)
       VALUES ($1, 'issue', $2, $3, $4)`,
      [eventType, entityId, severity, JSON.stringify(details)],
    );
  } catch {
    // Never let anti-gaming logging crash the main flow
  }
}

// ── Checks ────────────────────────────────────────────────────────────────────

/**
 * Velocity check: flag if the issue gained >1000 supports in the last 10 minutes.
 */
export async function checkVelocity(issueId, currentCount) {
  if (currentCount < MIN_SUPPORTS_FOR_ANALYSIS) return;

  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM supports
       WHERE issue_id = $1 AND created_at >= NOW() - INTERVAL '10 minutes'`,
      [issueId],
    );

    const burst = parseInt(rows[0].cnt, 10);
    if (burst >= VELOCITY_THRESHOLD) {
      await logFlag('high_velocity_supports', issueId, 'warning', {
        burst,
        window: '10m',
        totalCount: currentCount,
      });
    }
  } catch {
    // non-fatal
  }
}

/**
 * IP diversity check: flag if >50% of supports come from the same /24 subnet.
 * ip_hash is a SHA-256 of the real IP — we can't recover the subnet, but we
 * CAN detect repetition in the first N characters of the hash as a proxy.
 * A proper implementation would store a truncated IP prefix column in Phase 2.
 * For now we flag issues where >50% of rows share an identical ip_hash.
 */
export async function checkIpDiversity(issueId) {
  try {
    const { rows: total } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM supports WHERE issue_id = $1 AND ip_hash IS NOT NULL`,
      [issueId],
    );
    const totalWithIp = parseInt(total[0].cnt, 10);
    if (totalWithIp < MIN_SUPPORTS_FOR_ANALYSIS) return;

    const { rows } = await pool.query(
      `SELECT ip_hash, COUNT(*) AS cnt
       FROM supports
       WHERE issue_id = $1 AND ip_hash IS NOT NULL
       GROUP BY ip_hash
       ORDER BY cnt DESC
       LIMIT 1`,
      [issueId],
    );

    if (!rows.length) return;

    const topCount = parseInt(rows[0].cnt, 10);
    const concentration = topCount / totalWithIp;

    if (concentration > IP_CONCENTRATION_THRESHOLD) {
      await logFlag('ip_concentration', issueId, 'warning', {
        topIpHash: rows[0].ip_hash,
        topCount,
        totalWithIp,
        concentration: parseFloat(concentration.toFixed(3)),
      });
    }
  } catch {
    // non-fatal
  }
}

/**
 * Device fingerprint diversity check: flag if >70% of supports share one user-agent hash.
 */
export async function checkUaDiversity(issueId) {
  try {
    const { rows: total } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM supports WHERE issue_id = $1 AND user_agent_hash IS NOT NULL`,
      [issueId],
    );
    const totalWithUa = parseInt(total[0].cnt, 10);
    if (totalWithUa < MIN_SUPPORTS_FOR_ANALYSIS) return;

    const { rows } = await pool.query(
      `SELECT user_agent_hash, COUNT(*) AS cnt
       FROM supports
       WHERE issue_id = $1 AND user_agent_hash IS NOT NULL
       GROUP BY user_agent_hash
       ORDER BY cnt DESC
       LIMIT 1`,
      [issueId],
    );

    if (!rows.length) return;

    const topCount = parseInt(rows[0].cnt, 10);
    const concentration = topCount / totalWithUa;

    if (concentration > UA_CONCENTRATION_THRESHOLD) {
      await logFlag('ua_concentration', issueId, 'warning', {
        topUaHash: rows[0].user_agent_hash,
        topCount,
        totalWithUa,
        concentration: parseFloat(concentration.toFixed(3)),
      });
    }
  } catch {
    // non-fatal
  }
}

/**
 * Run all anti-gaming checks for an issue.
 * Called fire-and-forget after a support is recorded.
 */
export async function runChecks(issueId, currentCount) {
  // Run in parallel — all non-fatal
  await Promise.allSettled([
    checkVelocity(issueId, currentCount),
    checkIpDiversity(issueId),
    checkUaDiversity(issueId),
  ]);
}
