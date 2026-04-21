/**
 * Story model — thin DB layer for issue_stories.
 * All methods return camelCase objects.
 */
import pool from '../db/postgres.js';
import { toCamelCase } from '../utils/transform.js';

const STORY_COLS = `
  s.id, s.issue_id, s.author_id, s.is_anonymous,
  s.content, s.photos, s.helpful_count, s.status,
  s.created_at, s.updated_at,
  u.name   AS author_name,
  u.avatar_url AS author_avatar_url
`;

const JOIN_CLAUSE = `
  FROM issue_stories s
  LEFT JOIN users u ON s.author_id = u.id
`;

function transformRow(row) {
  const c = toCamelCase(row);
  c.author =
    c.isAnonymous || !c.authorId
      ? { name: 'Anonymous Citizen', avatarUrl: null }
      : { id: c.authorId, name: c.authorName, avatarUrl: c.authorAvatarUrl };
  delete c.authorName;
  delete c.authorAvatarUrl;
  return c;
}

/**
 * Insert a new story and atomically increment issues.story_count.
 */
export async function create({ issueId, authorId, isAnonymous = false, content, photos = [] }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO issue_stories (issue_id, author_id, is_anonymous, content, photos)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [issueId, authorId || null, isAnonymous, content, JSON.stringify(photos)],
    );
    const storyId = rows[0].id;

    await client.query(
      `UPDATE issues SET story_count = story_count + 1, updated_at = NOW() WHERE id = $1`,
      [issueId],
    );

    await client.query('COMMIT');

    return findById(storyId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Fetch a single story with author join.
 */
export async function findById(id) {
  const { rows } = await pool.query(`SELECT ${STORY_COLS} ${JOIN_CLAUSE} WHERE s.id = $1`, [id]);
  return rows.length ? transformRow(rows[0]) : null;
}

/**
 * Paginated list of active stories for an issue, newest first.
 */
export async function findByIssue(issueId, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;

  const [countResult, dataResult] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM issue_stories WHERE issue_id = $1 AND status = 'active'`, [
      issueId,
    ]),
    pool.query(
      `SELECT ${STORY_COLS} ${JOIN_CLAUSE}
       WHERE s.issue_id = $1 AND s.status = 'active'
       ORDER BY s.created_at DESC
       LIMIT $2 OFFSET $3`,
      [issueId, limit, offset],
    ),
  ]);

  return {
    data: dataResult.rows.map(transformRow),
    pagination: {
      page,
      limit,
      total: parseInt(countResult.rows[0].count, 10),
      totalPages: Math.ceil(parseInt(countResult.rows[0].count, 10) / limit),
    },
  };
}

/**
 * Toggle "helpful" vote. Returns { helpful_count, userVoted }.
 * Uses INSERT ... ON CONFLICT to deduplicate; DELETE removes the vote.
 */
export async function toggleHelpful(storyId, userId) {
  // Check if already voted
  const { rows: existing } = await pool.query(
    `SELECT 1 FROM story_helpful WHERE story_id = $1 AND user_id = $2`,
    [storyId, userId],
  );

  let delta;
  if (existing.length > 0) {
    // Remove vote
    await pool.query(`DELETE FROM story_helpful WHERE story_id = $1 AND user_id = $2`, [
      storyId,
      userId,
    ]);
    delta = -1;
  } else {
    // Add vote
    await pool.query(
      `INSERT INTO story_helpful (story_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [storyId, userId],
    );
    delta = 1;
  }

  const { rows } = await pool.query(
    `UPDATE issue_stories
     SET helpful_count = GREATEST(0, helpful_count + $2), updated_at = NOW()
     WHERE id = $1
     RETURNING helpful_count`,
    [storyId, delta],
  );

  return {
    helpfulCount: rows[0]?.helpful_count ?? 0,
    userVoted: delta === 1,
  };
}

/**
 * Check which storyIds a user has already voted helpful on.
 */
export async function getUserHelpfulVotes(userId, storyIds) {
  if (!storyIds.length) return new Set();
  const { rows } = await pool.query(
    `SELECT story_id FROM story_helpful WHERE user_id = $1 AND story_id = ANY($2::uuid[])`,
    [userId, storyIds],
  );
  return new Set(rows.map((r) => r.story_id));
}

/**
 * Soft-remove a story (set status = 'removed').
 * Also decrements issues.story_count.
 */
export async function remove(storyId, issueId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE issue_stories SET status = 'removed', updated_at = NOW() WHERE id = $1`,
      [storyId],
    );
    await client.query(
      `UPDATE issues SET story_count = GREATEST(0, story_count - 1), updated_at = NOW() WHERE id = $1`,
      [issueId],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Find the issue_id for a story (needed for ownership checks).
 */
export async function getIssueId(storyId) {
  const { rows } = await pool.query(`SELECT issue_id, author_id FROM issue_stories WHERE id = $1`, [
    storyId,
  ]);
  return rows.length ? toCamelCase(rows[0]) : null;
}
