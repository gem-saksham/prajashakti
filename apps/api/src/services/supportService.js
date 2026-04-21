/**
 * Support Service — the rallying mechanism.
 *
 * Atomic counter strategy:
 *   SOURCE OF TRUTH : issues.supporter_count in PostgreSQL
 *   HOT CACHE       : issue:count:{id}       in Redis
 *   WRITE           : PostgreSQL FIRST (in a transaction), then Redis.
 *                     If Redis fails, PostgreSQL is still correct.
 *   READ            : Redis first, PostgreSQL fallback on miss.
 *   NEVER           : increment Redis before PostgreSQL.
 */

import { createHash } from 'crypto';
import pool from '../db/postgres.js';
import { toCamelCase } from '../utils/transform.js';
import { ServiceError } from './userService.js';
import { computeSupportWeight } from '../utils/supportWeight.js';
import { emit } from './eventBus.js';
import { runChecks } from './antiGamingService.js';
import { logActivity } from '../models/userActivity.js';
import * as IssueModel from '../models/issue.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const MILESTONES = [10, 50, 100, 500, 1000, 5000, 10000, 50000];

// Redis key helpers
const countKey = (id) => `issue:count:${id}`;
const supportersKey = (id) => `issue:supporters:${id}`;
const rateKey = (uid) => `rate:support:${uid}`;
const RATE_LIMIT = 60; // max supports per minute per user
const SUPPORTERS_CACHE_TTL = 120; // 2 min for paginated supporters list
const SUPPORTED_ISSUES_TTL = 60;

// ── Milestone helpers ─────────────────────────────────────────────────────────

function checkMilestone(oldCount, newCount) {
  for (const m of MILESTONES) {
    if (oldCount < m && newCount >= m) return m;
  }
  return null;
}

// ── Hash helpers (for anti-gaming) ───────────────────────────────────────────

function shortHash(value) {
  if (!value) return null;
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 32);
}

// ── Core actions ──────────────────────────────────────────────────────────────

/**
 * Support an issue.
 *
 * @param {string} userId
 * @param {string} issueId
 * @param {object} opts — { redis, ipAddress, userAgent }
 * @returns {{ supporterCount: number, weight: number, milestone: number|null }}
 */
export async function supportIssue(userId, issueId, opts = {}) {
  const { redis, ipAddress, userAgent } = opts;

  // ── Rate limit: 60 supports/min per user ──────────────────────────────────
  if (redis) {
    const rk = rateKey(userId);
    const current = await redis.incr(rk);
    if (current === 1) await redis.expire(rk, 60);
    if (current > RATE_LIMIT) {
      throw new ServiceError(429, 'RATE_LIMITED', 'Too many supports. Please slow down.');
    }
  }

  // ── Fetch user for weight calculation ─────────────────────────────────────
  const { rows: userRows } = await pool.query(
    `SELECT id, role, is_verified, reputation_score, created_at FROM users WHERE id = $1`,
    [userId],
  );
  if (!userRows.length) throw new ServiceError(404, 'USER_NOT_FOUND', 'User not found');
  const user = toCamelCase(userRows[0]);

  // ── Check issue exists and is not closed (Redis hot check first) ──────────
  const issue = await IssueModel.findById(issueId);
  if (!issue) throw new ServiceError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
  if (issue.status === 'closed') {
    throw new ServiceError(400, 'ISSUE_CLOSED', 'Cannot support a closed issue');
  }

  const weight = computeSupportWeight(user);
  const oldCount = issue.supporterCount;

  // ── Atomic transaction: INSERT support + INCREMENT counter ────────────────
  const client = await pool.connect();
  let newCount;

  try {
    await client.query('BEGIN');

    // ON CONFLICT DO NOTHING handles the duplicate gracefully
    const { rows: insertRows } = await client.query(
      `INSERT INTO supports (user_id, issue_id, weight, source, ip_hash, user_agent_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, issue_id) DO NOTHING
       RETURNING user_id`,
      [userId, issueId, weight, opts.source || 'web', shortHash(ipAddress), shortHash(userAgent)],
    );

    if (!insertRows.length) {
      // Already supported — roll back and report
      await client.query('ROLLBACK');
      throw new ServiceError(409, 'ALREADY_SUPPORTED', 'You have already supported this issue');
    }

    const { rows: updRows } = await client.query(
      `UPDATE issues
       SET supporter_count = supporter_count + 1, updated_at = NOW()
       WHERE id = $1
       RETURNING supporter_count`,
      [issueId],
    );
    newCount = updRows[0].supporter_count;

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  // ── Redis: update hot cache (non-fatal) ───────────────────────────────────
  if (redis) {
    redis.set(countKey(issueId), newCount).catch(() => {});
    redis.zadd(supportersKey(issueId), Date.now(), userId).catch(() => {});
    // Invalidate cached supporters list
    redis.del(`supporters:${issueId}:*`).catch(() => {});
  }

  // ── Events ────────────────────────────────────────────────────────────────
  emit('issue.supported', { issueId, userId, newCount, weight });

  // ── Milestone detection ───────────────────────────────────────────────────
  const milestone = checkMilestone(oldCount, newCount);
  if (milestone) {
    emit('issue.milestone.reached', { issueId, milestone, crossedAt: new Date().toISOString() });

    // Promote to 'trending' at 100 supporters
    if (milestone >= 100 && issue.status === 'active') {
      IssueModel.updateStatus(issueId, 'trending').catch(() => {});
      emit('issue.trending', { issueId });
    }
  }

  // ── Activity log (fire-and-forget) ────────────────────────────────────────
  logActivity(userId, 'issue_supported', 'issue', issueId).catch(() => {});

  // ── Anti-gaming checks (fire-and-forget) ──────────────────────────────────
  runChecks(issueId, newCount).catch(() => {});

  return { supporterCount: newCount, weight, milestone };
}

/**
 * Remove support from an issue.
 *
 * @param {string} userId
 * @param {string} issueId
 * @param {object} opts — { redis }
 * @returns {{ supporterCount: number }}
 */
export async function unsupportIssue(userId, issueId, opts = {}) {
  const { redis } = opts;

  const client = await pool.connect();
  let newCount;

  try {
    await client.query('BEGIN');

    const { rows: delRows } = await client.query(
      `DELETE FROM supports WHERE user_id = $1 AND issue_id = $2 RETURNING user_id`,
      [userId, issueId],
    );

    if (!delRows.length) {
      await client.query('ROLLBACK');
      throw new ServiceError(404, 'NOT_SUPPORTED', 'You have not supported this issue');
    }

    const { rows: updRows } = await client.query(
      `UPDATE issues
       SET supporter_count = GREATEST(0, supporter_count - 1), updated_at = NOW()
       WHERE id = $1
       RETURNING supporter_count`,
      [issueId],
    );
    newCount = updRows[0].supporter_count;

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  // ── Redis (non-fatal) ────────────────────────────────────────────────────
  if (redis) {
    redis.set(countKey(issueId), newCount).catch(() => {});
    redis.zrem(supportersKey(issueId), userId).catch(() => {});
  }

  emit('issue.unsupported', { issueId, userId, newCount });
  logActivity(userId, 'issue_unsupported', 'issue', issueId).catch(() => {});

  return { supporterCount: newCount };
}

/**
 * Check whether a user has supported an issue.
 * Redis sorted-set first, DB fallback.
 *
 * @param {string} userId
 * @param {string} issueId
 * @param {object|null} redis
 * @returns {boolean}
 */
export async function hasUserSupported(userId, issueId, redis = null) {
  if (redis) {
    const score = await redis.zscore(supportersKey(issueId), userId);
    if (score !== null) return true;
    // null could mean "not there" or "not loaded yet" — fall through to DB
  }

  const { rows } = await pool.query(`SELECT 1 FROM supports WHERE user_id = $1 AND issue_id = $2`, [
    userId,
    issueId,
  ]);
  return rows.length > 0;
}

/**
 * Get the live supporter count for an issue.
 * Redis first (sub-ms), DB fallback.
 *
 * @param {string} issueId
 * @param {object|null} redis
 * @returns {number}
 */
export async function getSupportCount(issueId, redis = null) {
  if (redis) {
    const cached = await redis.get(countKey(issueId));
    if (cached !== null) return parseInt(cached, 10);
  }

  const { rows } = await pool.query(`SELECT supporter_count FROM issues WHERE id = $1`, [issueId]);
  const count = rows.length ? rows[0].supporter_count : 0;

  if (redis) redis.set(countKey(issueId), count).catch(() => {});
  return count;
}

/**
 * Paginated list of supporters for an issue.
 * Returns public fields only (name, avatar, district, state).
 *
 * @param {string} issueId
 * @param {{ page, limit }} pagination
 * @param {object|null} redis
 */
export async function getSupporters(issueId, pagination, redis = null) {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  const cacheKey = `supporters:${issueId}:${page}:${limit}`;
  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  const [countResult, dataResult] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM supports WHERE issue_id = $1`, [issueId]),
    pool.query(
      `SELECT u.id, u.name, u.avatar_url, u.district, u.state, u.is_verified,
              s.created_at AS supported_at, s.weight
       FROM supports s
       JOIN users u ON s.user_id = u.id
       WHERE s.issue_id = $1
       ORDER BY s.created_at DESC
       LIMIT $2 OFFSET $3`,
      [issueId, limit, offset],
    ),
  ]);

  const result = {
    data: dataResult.rows.map(toCamelCase),
    pagination: {
      page,
      limit,
      total: parseInt(countResult.rows[0].count, 10),
      totalPages: Math.ceil(parseInt(countResult.rows[0].count, 10) / limit),
    },
  };

  if (redis) redis.setex(cacheKey, SUPPORTERS_CACHE_TTL, JSON.stringify(result)).catch(() => {});
  return result;
}

/**
 * All issues a user has supported (for their profile page).
 *
 * @param {string} userId
 * @param {{ page, limit }} pagination
 */
export async function getUserSupportedIssues(userId, pagination) {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  const [countResult, dataResult] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM supports WHERE user_id = $1`, [userId]),
    pool.query(
      `SELECT i.id, i.title, i.category, i.urgency, i.status,
              i.supporter_count, i.district, i.state, i.created_at,
              s.created_at AS supported_at
       FROM supports s
       JOIN issues i ON s.issue_id = i.id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    ),
  ]);

  return {
    data: dataResult.rows.map(toCamelCase),
    pagination: {
      page,
      limit,
      total: parseInt(countResult.rows[0].count, 10),
      totalPages: Math.ceil(parseInt(countResult.rows[0].count, 10) / limit),
    },
  };
}

/**
 * Support velocity: supports per hour over the last 24 hours.
 * Returns an array of 24 hourly buckets (most recent last).
 *
 * @param {string} issueId
 * @returns {Array<{ hour: string, count: number }>}
 */
export async function getSupportVelocity(issueId) {
  const { rows } = await pool.query(
    `SELECT
       date_trunc('hour', created_at)         AS hour,
       COUNT(*)                               AS cnt
     FROM supports
     WHERE issue_id = $1
       AND created_at >= NOW() - INTERVAL '24 hours'
     GROUP BY hour
     ORDER BY hour ASC`,
    [issueId],
  );

  return rows.map((r) => ({
    hour: r.hour,
    count: parseInt(r.cnt, 10),
  }));
}

/**
 * Support stats for an issue.
 * Combines count (Redis fast path), velocity, and milestone progress.
 *
 * @param {string} issueId
 * @param {object|null} redis
 */
export async function getSupportStats(issueId, redis = null) {
  const [count, velocity] = await Promise.all([
    getSupportCount(issueId, redis),
    getSupportVelocity(issueId),
  ]);

  const totalVelocity = velocity.reduce((acc, b) => acc + b.count, 0);
  const peakHour = velocity.reduce((best, b) => (b.count > (best?.count || 0) ? b : best), null);

  // Next milestone
  const nextMilestone = MILESTONES.find((m) => m > count) || null;
  const crossedMilestones = MILESTONES.filter((m) => m <= count);

  return {
    supporterCount: count,
    last24hSupports: totalVelocity,
    peakHour: peakHour ? { hour: peakHour.hour, count: peakHour.count } : null,
    velocity,
    nextMilestone,
    crossedMilestones,
  };
}

/**
 * Reconcile Redis counter against PostgreSQL source of truth.
 * Returns a list of drift entries found (and corrects them).
 * Called by a cron job every 10 minutes.
 *
 * @param {object} redis
 * @param {number} limit  — max issues to check per run
 */
export async function reconcileCounters(redis, limit = 500) {
  const { rows } = await pool.query(
    `SELECT id, supporter_count FROM issues WHERE status != 'closed' LIMIT $1`,
    [limit],
  );

  const drifts = [];

  for (const row of rows) {
    const cached = await redis.get(countKey(row.id));
    if (cached === null) continue; // no cache entry — not a drift, just a cold key

    const cachedCount = parseInt(cached, 10);
    const dbCount = row.supporter_count;

    if (cachedCount !== dbCount) {
      drifts.push({ issueId: row.id, cachedCount, dbCount });
      // Correct the cache to match PostgreSQL
      await redis.set(countKey(row.id), dbCount);
    }
  }

  if (drifts.length > 0) {
    console.warn(`[reconcile] Fixed ${drifts.length} counter drift(s):`, drifts);
  }

  return drifts;
}
