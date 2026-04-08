/**
 * User Activity model — thin DB query layer for user_activity table.
 *
 * Public actions (safe to expose on public profiles):
 *   issue_created, issue_supported, comment_posted, aadhaar_verified
 *
 * Private actions (stored but excluded from public queries):
 *   login, profile_updated
 */

import pool from '../db/postgres.js';
import { toCamelCase } from '../utils/transform.js';

const PUBLIC_ACTIONS = ['issue_created', 'issue_supported', 'comment_posted', 'aadhaar_verified'];

/**
 * Log a user action. Fire-and-forget — callers should not await this if
 * they don't want it to block the response.
 *
 * @param {string}      userId
 * @param {string}      action      - e.g. 'issue_created'
 * @param {string|null} entityType  - e.g. 'issue', 'comment'
 * @param {string|null} entityId    - UUID of the related entity
 * @param {object}      metadata    - arbitrary extra context
 */
export async function logActivity(
  userId,
  action,
  entityType = null,
  entityId = null,
  metadata = {},
) {
  try {
    await pool.query(
      `INSERT INTO user_activity (user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, entityType, entityId, JSON.stringify(metadata)],
    );
  } catch (err) {
    // Non-fatal — log but don't surface to caller
    console.error('[userActivity] logActivity error:', err.message);
  }
}

/**
 * Fetch the public activity feed for a user profile.
 * Excludes sensitive actions (login, profile_updated).
 *
 * @param {string} userId
 * @param {number} page
 * @param {number} limit
 * @returns {{ activities: object[], total: number }}
 */
export async function getPublicActivity(userId, page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  const [rows, countRow] = await Promise.all([
    pool.query(
      `SELECT id, action, entity_type, entity_id, metadata, created_at
       FROM   user_activity
       WHERE  user_id = $1
         AND  action  = ANY($2::text[])
       ORDER  BY created_at DESC
       LIMIT  $3 OFFSET $4`,
      [userId, PUBLIC_ACTIONS, limit, offset],
    ),
    pool.query(
      `SELECT COUNT(*) FROM user_activity
       WHERE user_id = $1 AND action = ANY($2::text[])`,
      [userId, PUBLIC_ACTIONS],
    ),
  ]);

  return {
    activities: rows.rows.map((r) => toCamelCase(r)),
    total: parseInt(countRow.rows[0].count, 10),
  };
}
