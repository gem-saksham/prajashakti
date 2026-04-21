/**
 * Official model — query layer for officials and issue_officials tables.
 * All methods return camelCase objects.
 */

import pool from '../db/postgres.js';
import { toCamelCase } from '../utils/transform.js';

// ── Column list ───────────────────────────────────────────────────────────────

const OFFICIAL_COLS = `
  o.id, o.name, o.designation,
  o.department_id, o.ministry_id,
  o.jurisdiction_type, o.jurisdiction_code, o.state_code, o.district_code,
  o.public_email, o.public_phone, o.office_address, o.twitter_handle,
  o.total_issues_tagged, o.total_issues_resolved,
  o.avg_resolution_days, o.citizen_satisfaction_score, o.discrepancy_score,
  o.cadre, o.batch_year, o.source, o.is_verified,
  o.claimed_by_user_id, o.claimed_at,
  o.created_at, o.updated_at
`;

const OFFICIAL_WITH_JOINS = `
  ${OFFICIAL_COLS},
  d.name  AS department_name,
  d.code  AS department_code,
  m.name  AS ministry_name,
  m.code  AS ministry_code
`;

const JOIN_CLAUSE = `
  FROM officials o
  LEFT JOIN departments d ON o.department_id = d.id
  LEFT JOIN ministries  m ON o.ministry_id   = m.id
`;

function transformRow(row) {
  if (!row) return null;
  const r = toCamelCase(row);

  r.department = r.departmentId
    ? { id: r.departmentId, name: r.departmentName, code: r.departmentCode }
    : null;
  r.ministry = r.ministryId
    ? { id: r.ministryId, name: r.ministryName, code: r.ministryCode }
    : null;
  delete r.departmentName;
  delete r.departmentCode;
  delete r.ministryName;
  delete r.ministryCode;

  return r;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function create(data) {
  const { rows } = await pool.query(
    `INSERT INTO officials (
       name, designation, department_id, ministry_id,
       jurisdiction_type, jurisdiction_code, state_code, district_code,
       public_email, public_phone, office_address, twitter_handle,
       cadre, batch_year, source, is_verified
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
     ) RETURNING id`,
    [
      data.name,
      data.designation,
      data.departmentId || null,
      data.ministryId || null,
      data.jurisdictionType || null,
      data.jurisdictionCode || null,
      data.stateCode || null,
      data.districtCode || null,
      data.publicEmail || null,
      data.publicPhone || null,
      data.officeAddress || null,
      data.twitterHandle || null,
      data.cadre || null,
      data.batchYear || null,
      data.source || 'manual',
      data.isVerified || false,
    ],
  );
  return findById(rows[0].id);
}

export async function findById(id) {
  const { rows } = await pool.query(
    `SELECT ${OFFICIAL_WITH_JOINS} ${JOIN_CLAUSE} WHERE o.id = $1`,
    [id],
  );
  return rows.length ? transformRow(rows[0]) : null;
}

/**
 * Fuzzy search officials by name or designation using pg_trgm.
 * Optionally scoped to a state or district.
 */
export async function search(query, opts = {}) {
  const { stateCode, districtCode, limit = 20 } = opts;
  const conditions = [];
  const params = [query, query]; // $1 for name, $2 for designation
  let idx = 3;

  if (stateCode) {
    conditions.push(`o.state_code = $${idx++}`);
    params.push(stateCode.toUpperCase());
  }
  if (districtCode) {
    conditions.push(`o.district_code = $${idx++}`);
    params.push(districtCode.toUpperCase());
  }

  const whereClause = conditions.length
    ? `WHERE (o.name % $1 OR o.designation % $2 OR o.name ILIKE '%' || $1 || '%' OR o.designation ILIKE '%' || $2 || '%') AND ${conditions.join(' AND ')}`
    : `WHERE o.name % $1 OR o.designation % $2 OR o.name ILIKE '%' || $1 || '%' OR o.designation ILIKE '%' || $2 || '%'`;

  params.push(limit);

  const { rows } = await pool.query(
    `SELECT ${OFFICIAL_WITH_JOINS},
       GREATEST(similarity(o.name, $1), similarity(o.designation, $2)) AS sim_score
     ${JOIN_CLAUSE}
     ${whereClause}
     ORDER BY sim_score DESC, o.total_issues_tagged DESC
     LIMIT $${idx}`,
    params,
  );

  return rows.map((row) => {
    const r = transformRow(row);
    r.similarityScore = parseFloat(row.sim_score || 0);
    return r;
  });
}

/**
 * List officials with optional filters and pagination.
 */
export async function findAll(filters = {}, pagination = {}) {
  const { page = 1, limit = 20 } = pagination;
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.stateCode) {
    conditions.push(`o.state_code = $${idx++}`);
    params.push(filters.stateCode.toUpperCase());
  }
  if (filters.districtCode) {
    conditions.push(`o.district_code = $${idx++}`);
    params.push(filters.districtCode.toUpperCase());
  }
  if (filters.jurisdictionType) {
    conditions.push(`o.jurisdiction_type = $${idx++}`);
    params.push(filters.jurisdictionType);
  }
  if (filters.departmentId) {
    conditions.push(`o.department_id = $${idx++}`);
    params.push(filters.departmentId);
  }
  if (filters.ministryId) {
    conditions.push(`o.ministry_id = $${idx++}`);
    params.push(filters.ministryId);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const [countResult, dataResult] = await Promise.all([
    pool.query(`SELECT COUNT(*) ${JOIN_CLAUSE} ${whereClause}`, params),
    pool.query(
      `SELECT ${OFFICIAL_WITH_JOINS} ${JOIN_CLAUSE}
       ${whereClause}
       ORDER BY o.total_issues_tagged DESC, o.name ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
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

// ── Issue-Official join operations ────────────────────────────────────────────

export async function tagToIssue(issueId, officialId, userId, tagType = 'primary') {
  const { rows } = await pool.query(
    `INSERT INTO issue_officials (issue_id, official_id, tagged_by, tag_type)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (issue_id, official_id) DO NOTHING
     RETURNING *`,
    [issueId, officialId, userId, tagType],
  );
  return rows.length ? toCamelCase(rows[0]) : null; // null = already tagged
}

export async function untagFromIssue(issueId, officialId) {
  const { rows } = await pool.query(
    `DELETE FROM issue_officials WHERE issue_id = $1 AND official_id = $2
     RETURNING *`,
    [issueId, officialId],
  );
  return rows.length > 0;
}

export async function getOfficialsForIssue(issueId) {
  const { rows } = await pool.query(
    `SELECT ${OFFICIAL_WITH_JOINS},
            io.tag_type, io.tagged_at, io.tagged_by
     ${JOIN_CLAUSE}
     JOIN issue_officials io ON io.official_id = o.id
     WHERE io.issue_id = $1
     ORDER BY io.tag_type, io.tagged_at ASC`,
    [issueId],
  );

  return rows.map((row) => {
    const r = transformRow(row);
    r.tagType = row.tag_type;
    r.taggedAt = row.tagged_at;
    return r;
  });
}

export async function getIssueCountForOfficial(officialId) {
  const { rows } = await pool.query(`SELECT COUNT(*) FROM issue_officials WHERE official_id = $1`, [
    officialId,
  ]);
  return parseInt(rows[0].count, 10);
}

/**
 * Atomically increment total_issues_tagged for an official.
 */
export async function incrementTaggedCount(officialId, delta = 1) {
  await pool.query(
    `UPDATE officials
     SET total_issues_tagged = total_issues_tagged + $2, updated_at = NOW()
     WHERE id = $1`,
    [officialId, delta],
  );
}

/**
 * Claim official profile — links to a user account.
 * In Phase 3, this will be gated by verification doc upload.
 */
export async function claimProfile(officialId, userId) {
  const { rows } = await pool.query(
    `UPDATE officials
     SET claimed_by_user_id = $2, claimed_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND claimed_by_user_id IS NULL
     RETURNING id, claimed_by_user_id, claimed_at`,
    [officialId, userId],
  );
  return rows.length ? toCamelCase(rows[0]) : null;
}

/**
 * Get officials matching a department and jurisdiction for auto-suggestion.
 */
export async function findByDepartmentAndJurisdiction(departmentId, stateCode = null) {
  const params = [departmentId];
  let stateFilter = '';
  if (stateCode) {
    stateFilter = 'AND o.state_code = $2';
    params.push(stateCode.toUpperCase());
  }

  const { rows } = await pool.query(
    `SELECT ${OFFICIAL_WITH_JOINS} ${JOIN_CLAUSE}
     WHERE o.department_id = $1 ${stateFilter}
     ORDER BY o.total_issues_tagged DESC
     LIMIT 5`,
    params,
  );
  return rows.map(transformRow);
}
