/**
 * Issue model — thin DB query layer.
 * All methods accept and return camelCase objects.
 * Raw SQL goes here; business logic lives in issueService.js.
 */

import pool from '../db/postgres.js';
import { toCamelCase } from '../utils/transform.js';

// ── Column lists ─────────────────────────────────────────────────────────────

const ISSUE_COLS = `
  i.id, i.title, i.description, i.category, i.urgency,
  i.ministry_id, i.department_id, i.grievance_category_id,
  i.official_name, i.official_designation, i.official_department,
  i.location_lat, i.location_lng, i.district, i.state, i.pincode, i.formatted_address,
  i.photos, i.status,
  i.supporter_count, i.comment_count, i.share_count, i.view_count,
  i.is_campaign, i.target_supporters, i.campaign_deadline,
  i.escalation_level, i.escalated_at,
  i.tracking_ids,
  i.resolved_at, i.resolution_notes, i.discrepancy_score,
  i.created_by, i.is_anonymous, i.is_verified_location,
  i.created_at, i.updated_at
`;

const ISSUE_WITH_JOINS = `
  ${ISSUE_COLS},
  m.name   AS ministry_name,
  m.code   AS ministry_code,
  d.name   AS department_name,
  d.code   AS department_code,
  gc.name  AS grievance_category_name,
  gc.slug  AS grievance_category_slug,
  u.name   AS creator_name,
  u.avatar_url AS creator_avatar_url,
  u.district   AS creator_district,
  u.state      AS creator_state
`;

const JOIN_CLAUSE = `
  FROM issues i
  LEFT JOIN ministries m            ON i.ministry_id = m.id
  LEFT JOIN departments d           ON i.department_id = d.id
  LEFT JOIN grievance_categories gc ON i.grievance_category_id = gc.id
  LEFT JOIN users u                 ON i.created_by = u.id
`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function transformRow(row) {
  if (!row) return null;
  const camel = toCamelCase(row);

  // Nest joined fields into sub-objects for clean API responses
  if ('ministryName' in camel) {
    camel.ministry = camel.ministryId
      ? { id: camel.ministryId, name: camel.ministryName, code: camel.ministryCode }
      : null;
    delete camel.ministryName;
    delete camel.ministryCode;
  }
  if ('departmentName' in camel) {
    camel.department = camel.departmentId
      ? { id: camel.departmentId, name: camel.departmentName, code: camel.departmentCode }
      : null;
    delete camel.departmentName;
    delete camel.departmentCode;
  }
  if ('grievanceCategoryName' in camel) {
    camel.grievanceCategory = camel.grievanceCategoryId
      ? {
          id: camel.grievanceCategoryId,
          name: camel.grievanceCategoryName,
          slug: camel.grievanceCategorySlug,
        }
      : null;
    delete camel.grievanceCategoryName;
    delete camel.grievanceCategorySlug;
  }
  if ('creatorName' in camel) {
    camel.creator = {
      id: camel.createdBy,
      name: camel.isAnonymous ? 'Anonymous Citizen' : camel.creatorName,
      avatarUrl: camel.isAnonymous ? null : camel.creatorAvatarUrl,
      district: camel.creatorDistrict,
      state: camel.creatorState,
    };
    delete camel.creatorName;
    delete camel.creatorAvatarUrl;
    delete camel.creatorDistrict;
    delete camel.creatorState;
  }

  return camel;
}

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Insert a new issue. Returns the full issue with joined data.
 */
export async function create(data) {
  const { rows } = await pool.query(
    `INSERT INTO issues (
       title, description, category, urgency,
       ministry_id, department_id, grievance_category_id,
       official_name, official_designation, official_department,
       location_lat, location_lng, district, state, pincode, formatted_address,
       photos, created_by, is_anonymous
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
     ) RETURNING id`,
    [
      data.title,
      data.description,
      data.category,
      data.urgency || 'medium',
      data.ministryId || null,
      data.departmentId || null,
      data.grievanceCategoryId || null,
      data.officialName || null,
      data.officialDesignation || null,
      data.officialDepartment || null,
      data.locationLat,
      data.locationLng,
      data.district || null,
      data.state || null,
      data.pincode || null,
      data.formattedAddress || null,
      JSON.stringify(data.photos || []),
      data.createdBy,
      data.isAnonymous || false,
    ],
  );

  return findById(rows[0].id);
}

/**
 * Find a single issue by ID with all joined data.
 */
export async function findById(id) {
  const { rows } = await pool.query(`SELECT ${ISSUE_WITH_JOINS} ${JOIN_CLAUSE} WHERE i.id = $1`, [
    id,
  ]);
  return rows.length ? transformRow(rows[0]) : null;
}

/**
 * Paginated list of issues with filters.
 *
 * @param {Object} filters - { status, category, urgency, district, state, createdBy, isCampaign, search }
 * @param {Object} pagination - { page, limit, sort }
 */
export async function findAll(filters = {}, pagination = {}) {
  const { page = 1, limit = 20, sort = 'newest' } = pagination;
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (filters.status) {
    conditions.push(`i.status = $${paramIdx++}`);
    params.push(filters.status);
  } else {
    // Default: exclude closed
    conditions.push(`i.status != 'closed'`);
  }

  if (filters.category) {
    conditions.push(`i.category = $${paramIdx++}`);
    params.push(filters.category);
  }
  if (filters.urgency) {
    conditions.push(`i.urgency = $${paramIdx++}`);
    params.push(filters.urgency);
  }
  if (filters.district) {
    conditions.push(`i.district = $${paramIdx++}`);
    params.push(filters.district);
  }
  if (filters.state) {
    conditions.push(`i.state = $${paramIdx++}`);
    params.push(filters.state);
  }
  if (filters.createdBy) {
    conditions.push(`i.created_by = $${paramIdx++}`);
    params.push(filters.createdBy);
  }
  if (filters.isCampaign !== undefined) {
    conditions.push(`i.is_campaign = $${paramIdx++}`);
    params.push(filters.isCampaign);
  }
  if (filters.search) {
    conditions.push(`(i.title ILIKE $${paramIdx} OR i.description ILIKE $${paramIdx})`);
    params.push(`%${filters.search}%`);
    paramIdx++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const sortMap = {
    newest: 'i.created_at DESC',
    oldest: 'i.created_at ASC',
    most_supported: 'i.supporter_count DESC, i.created_at DESC',
    most_urgent: `CASE i.urgency
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
    END, i.created_at DESC`,
    most_viewed: 'i.view_count DESC, i.created_at DESC',
  };
  const orderClause = `ORDER BY ${sortMap[sort] || sortMap.newest}`;

  const offset = (page - 1) * limit;

  // Count query
  const countResult = await pool.query(`SELECT COUNT(*) ${JOIN_CLAUSE} ${whereClause}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  // Data query
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT ${ISSUE_WITH_JOINS} ${JOIN_CLAUSE} ${whereClause}
     ${orderClause}
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    params,
  );

  return {
    data: rows.map(transformRow),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Dynamic UPDATE with whitelist of allowed fields.
 * Only the issue creator or admin can update certain fields.
 */
const UPDATABLE_FIELDS = new Set([
  'title',
  'description',
  'category',
  'urgency',
  'ministry_id',
  'department_id',
  'grievance_category_id',
  'official_name',
  'official_designation',
  'official_department',
  'district',
  'state',
  'pincode',
  'formatted_address',
  'photos',
  'target_supporters',
  'campaign_deadline',
  'is_anonymous',
  'resolution_notes',
]);

export async function update(id, updates) {
  const entries = Object.entries(updates).filter(([k]) => UPDATABLE_FIELDS.has(k));
  if (entries.length === 0) return findById(id);

  const setClauses = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ');
  const values = entries.map(([, v]) =>
    typeof v === 'object' && v !== null ? JSON.stringify(v) : v,
  );

  await pool.query(`UPDATE issues SET ${setClauses}, updated_at = NOW() WHERE id = $1`, [
    id,
    ...values,
  ]);

  return findById(id);
}

/**
 * Atomic counter increment for supporter_count, comment_count, share_count, view_count.
 */
const COUNTER_FIELDS = new Set(['supporter_count', 'comment_count', 'share_count', 'view_count']);

export async function incrementCounter(id, field, delta = 1) {
  if (!COUNTER_FIELDS.has(field)) {
    throw new Error(`Invalid counter field: ${field}`);
  }

  const { rows } = await pool.query(
    `UPDATE issues
     SET ${field} = GREATEST(0, ${field} + $2), updated_at = NOW()
     WHERE id = $1
     RETURNING id, ${field}`,
    [id, delta],
  );
  return rows.length ? toCamelCase(rows[0]) : null;
}

/**
 * Update a specific key in tracking_ids JSONB.
 * Uses jsonb_set for atomic, key-level updates.
 */
export async function setTrackingId(id, key, value) {
  const { rows } = await pool.query(
    `UPDATE issues
     SET tracking_ids = jsonb_set(tracking_ids, $2, $3::jsonb), updated_at = NOW()
     WHERE id = $1
     RETURNING id, tracking_ids`,
    [id, `{${key}}`, JSON.stringify(value)],
  );
  return rows.length ? toCamelCase(rows[0]) : null;
}

/**
 * Fetch only the tracking_ids field for an issue.
 */
export async function getTrackingIds(id) {
  const { rows } = await pool.query('SELECT tracking_ids FROM issues WHERE id = $1', [id]);
  return rows.length ? rows[0].tracking_ids : null;
}

/**
 * Soft-delete: set status to 'closed', don't actually delete.
 */
export async function softDelete(id) {
  const { rows } = await pool.query(
    `UPDATE issues SET status = 'closed', updated_at = NOW()
     WHERE id = $1
     RETURNING id, status`,
    [id],
  );
  return rows.length ? toCamelCase(rows[0]) : null;
}

/**
 * Update issue status (separate from general update — used by escalation logic).
 */
export async function updateStatus(id, status) {
  const extraFields = {};
  if (status === 'escalated') extraFields.escalated_at = 'NOW()';
  if (status === 'officially_resolved' || status === 'citizen_verified_resolved') {
    extraFields.resolved_at = 'NOW()';
  }

  const extraSetClauses = Object.entries(extraFields)
    .map(([k, v]) => `${k} = ${v}`)
    .join(', ');

  const setClauses = `status = $2${extraSetClauses ? ', ' + extraSetClauses : ''}`;

  const { rows } = await pool.query(
    `UPDATE issues SET ${setClauses}, updated_at = NOW()
     WHERE id = $1
     RETURNING id, status, escalated_at, resolved_at`,
    [id, status],
  );
  return rows.length ? toCamelCase(rows[0]) : null;
}

/**
 * Geo query: find issues near a location using the Haversine formula.
 * Returns issues within radiusKm, ordered by distance.
 */
export async function findByLocation(lat, lng, radiusKm = 10, limit = 50) {
  const { rows } = await pool.query(
    `SELECT ${ISSUE_WITH_JOINS},
       (6371 * acos(
         cos(radians($1)) * cos(radians(i.location_lat)) *
         cos(radians(i.location_lng) - radians($2)) +
         sin(radians($1)) * sin(radians(i.location_lat))
       )) AS distance_km
     ${JOIN_CLAUSE}
     WHERE i.status != 'closed'
       AND (6371 * acos(
         cos(radians($1)) * cos(radians(i.location_lat)) *
         cos(radians(i.location_lng) - radians($2)) +
         sin(radians($1)) * sin(radians(i.location_lat))
       )) <= $3
     ORDER BY distance_km ASC
     LIMIT $4`,
    [lat, lng, radiusKm, limit],
  );

  return rows.map((row) => {
    const issue = transformRow(row);
    issue.distanceKm = parseFloat(row.distance_km);
    return issue;
  });
}

/**
 * Look up an issue by an external tracking ID stored in the JSONB field.
 * Uses the GIN index for fast @> containment queries.
 */
export async function findByTrackingId(key, value) {
  const containsObj = JSON.stringify({ [key]: value });

  const { rows } = await pool.query(
    `SELECT ${ISSUE_WITH_JOINS} ${JOIN_CLAUSE}
     WHERE i.tracking_ids @> $1::jsonb`,
    [containsObj],
  );

  return rows.map(transformRow);
}

/**
 * Update escalation level for an issue.
 */
export async function setEscalationLevel(id, level) {
  const { rows } = await pool.query(
    `UPDATE issues
     SET escalation_level = $2,
         escalated_at = CASE WHEN $2 > escalation_level THEN NOW() ELSE escalated_at END,
         status = CASE WHEN $2 > 0 AND status = 'active' THEN 'escalated' ELSE status END,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, escalation_level, escalated_at, status`,
    [id, level],
  );
  return rows.length ? toCamelCase(rows[0]) : null;
}

/**
 * Promote an issue to a campaign.
 */
export async function promoteToCampaign(id, targetSupporters, deadline) {
  const { rows } = await pool.query(
    `UPDATE issues
     SET is_campaign = true, target_supporters = $2, campaign_deadline = $3, updated_at = NOW()
     WHERE id = $1
     RETURNING id, is_campaign, target_supporters, campaign_deadline`,
    [id, targetSupporters, deadline || null],
  );
  return rows.length ? toCamelCase(rows[0]) : null;
}
