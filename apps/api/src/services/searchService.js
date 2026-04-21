/**
 * Search service — full-text search, autocomplete suggestions, and analytics.
 *
 * Key design decisions:
 *   - websearch_to_tsquery: safe for arbitrary user input (no injection, handles
 *     special chars and multi-word queries naturally)
 *   - Suggestions run 3 queries in parallel; Redis caches 5 minutes
 *   - logSearch is fire-and-forget — never throws, never degrades search
 *   - Hindi transliteration scaffold: simple keyword map; Phase 2 adds NLP
 */
import pool from '../db/postgres.js';
import { CATEGORIES } from '../middleware/validator.js';

const SUGGESTION_TTL = 300; // 5 minutes

// ── Hindi transliteration scaffold ───────────────────────────────────────────
// Phase 2 will replace this with a proper transliteration library.
const HINDI_MAP = {
  sadak: 'road',
  pani: 'water',
  bijli: 'electricity',
  safai: 'sanitation',
  swasthya: 'health',
  shiksha: 'education',
  bhrashtachar: 'corruption',
  kisan: 'agriculture',
  suraksha: 'safety',
  paryavaran: 'environment',
};

function resolveQuery(raw) {
  const lower = raw.toLowerCase().trim();
  return HINDI_MAP[lower] || raw.trim();
}

// ── Suggestions ───────────────────────────────────────────────────────────────

/**
 * Autocomplete suggestions for a partial query.
 * Target response time: <100 ms (Redis-cached).
 *
 * @param {string} rawQuery
 * @param {{ limit?: number, redis?: object }} opts
 * @returns {{ categories, locations, popularQueries, issues }}
 */
export async function getSuggestions(rawQuery, { limit = 5, redis } = {}) {
  if (!rawQuery?.trim()) {
    return { categories: [], locations: [], popularQueries: [], issues: [] };
  }

  const q = resolveQuery(rawQuery);
  const cacheKey = `srch:sug:${q.toLowerCase().slice(0, 50)}`;

  if (redis) {
    const hit = await redis.get(cacheKey).catch(() => null);
    if (hit) return JSON.parse(hit);
  }

  const pattern = `${q}%`;

  const [locResult, popResult, issueResult] = await Promise.all([
    // Locations: prefix match on states (with type) + districts (type = 'district')
    pool
      .query(
        `(SELECT name, type FROM states    WHERE name ILIKE $1 LIMIT $2)
         UNION ALL
         (SELECT name, 'district'::text AS type FROM districts WHERE name ILIKE $1 LIMIT $2)
         LIMIT $2`,
        [pattern, limit],
      )
      .catch(() => ({ rows: [] })),

    // Popular queries: most-searched in last 30 days
    pool
      .query(
        `SELECT query, COUNT(*) AS cnt
         FROM search_queries
         WHERE LOWER(query) LIKE LOWER($1)
           AND created_at > NOW() - INTERVAL '30 days'
         GROUP BY query
         ORDER BY cnt DESC
         LIMIT $2`,
        [pattern, limit],
      )
      .catch(() => ({ rows: [] })),

    // FTS issue matches: top 3 by supporter count
    pool
      .query(
        `SELECT id, title, supporter_count
         FROM issues
         WHERE search_vector @@ websearch_to_tsquery('english', $1)
           AND status != 'closed'
         ORDER BY supporter_count DESC, created_at DESC
         LIMIT 3`,
        [q],
      )
      .catch(() => ({ rows: [] })),
  ]);

  const result = {
    categories: CATEGORIES.filter((c) => c.toLowerCase().includes(q.toLowerCase())).slice(0, limit),
    // locations as {name, type} objects so the frontend can show the type badge
    locations: locResult.rows.map((r) => ({ name: r.name, type: r.type })),
    // 'queries' key (not popularQueries) matches what IssueSearchBar expects
    queries: popResult.rows.map((r) => r.query),
    issues: issueResult.rows.map((r) => ({
      id: r.id,
      title: r.title,
      supporterCount: Number(r.supporter_count) || 0,
    })),
  };

  // Cache only when we got at least one useful result
  if (redis) {
    const hasData =
      result.categories.length ||
      result.locations.length ||
      result.queries.length ||
      result.issues.length;
    if (hasData) {
      redis.setex(cacheKey, SUGGESTION_TTL, JSON.stringify(result)).catch(() => {});
    }
  }

  return result;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

/**
 * Log a completed search (fire-and-forget).
 */
export async function logSearch({ query, userId, filters, resultCount, sessionId }) {
  try {
    await pool.query(
      `INSERT INTO search_queries (user_id, query, filters, result_count, session_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId || null,
        String(query).slice(0, 500),
        JSON.stringify(filters || {}),
        resultCount ?? 0,
        sessionId || null,
      ],
    );
  } catch {
    // Never degrade search because of logging
  }
}

/**
 * Record that a user clicked a search result.
 * Updates the most recent matching log row.
 */
export async function recordClick({ query, userId, sessionId, clickedIssueId }) {
  try {
    await pool.query(
      `UPDATE search_queries
         SET clicked_issue_id = $1
       WHERE id = (
         SELECT id FROM search_queries
         WHERE ($2::uuid IS NULL OR user_id = $2)
           AND ($3::varchar  IS NULL OR session_id = $3)
           AND query = $4
         ORDER BY created_at DESC
         LIMIT 1
       )`,
      [clickedIssueId, userId || null, sessionId || null, String(query).slice(0, 500)],
    );
  } catch {
    // fire-and-forget
  }
}
