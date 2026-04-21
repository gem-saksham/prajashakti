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
  i.supporter_count, i.comment_count, i.share_count, i.view_count, i.story_count,
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
  // FTS search — track param index so ts_rank can reuse the same $N
  let searchParamIdx = null;
  if (filters.search) {
    searchParamIdx = paramIdx;
    conditions.push(`i.search_vector @@ websearch_to_tsquery('english', $${paramIdx++})`);
    params.push(filters.search);
  }

  // Geo radius filter (Haversine — works on plain NUMERIC lat/lng columns)
  if (filters.lat != null && filters.lng != null) {
    const radiusKm = filters.radiusKm || 10;
    conditions.push(`
      (6371 * acos(
        cos(radians($${paramIdx++})) * cos(radians(i.location_lat)) *
        cos(radians(i.location_lng) - radians($${paramIdx++})) +
        sin(radians($${paramIdx++})) * sin(radians(i.location_lat))
      )) <= $${paramIdx++}`);
    params.push(filters.lat, filters.lng, filters.lat, radiusKm);
  }

  // Day 26 advanced filters
  if (filters.minSupport > 0) {
    conditions.push(`i.supporter_count >= $${paramIdx++}`);
    params.push(filters.minSupport);
  }
  if (filters.dateRange && filters.dateRange !== 'all') {
    const INTERVALS = { day: '1 day', week: '7 days', month: '30 days', year: '365 days' };
    const interval = INTERVALS[filters.dateRange];
    if (interval) {
      conditions.push(`i.created_at >= NOW() - INTERVAL '${interval}'`);
    }
  }
  if (filters.hasPhotos) {
    conditions.push(`jsonb_array_length(i.photos) > 0`);
  }
  if (filters.verifiedOnly) {
    conditions.push(`i.is_verified_location = true`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const sortMap = {
    newest: 'i.created_at DESC',
    oldest: 'i.created_at ASC',
    most_supported: 'i.supporter_count DESC, i.created_at DESC',
    most_urgent: `CASE i.urgency
      WHEN 'critical' THEN 1
      WHEN 'high'     THEN 2
      WHEN 'medium'   THEN 3
      WHEN 'low'      THEN 4
    END, i.created_at DESC`,
    most_viewed: 'i.view_count DESC, i.created_at DESC',
    recently_updated: 'i.updated_at DESC',
    trending: `(LN(1 + i.supporter_count) * 0.35 + LN(1 + i.story_count) * 0.15 + LN(1 + i.view_count) * 0.05)
               / (1 + EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 86400 * 0.1) DESC`,
    oldest_unresolved: 'i.created_at ASC',
  };

  const baseSort = sortMap[sort] || sortMap.newest;
  const orderClause =
    searchParamIdx !== null
      ? `ORDER BY ts_rank(i.search_vector, websearch_to_tsquery('english', $${searchParamIdx})) DESC, ${baseSort}`
      : `ORDER BY ${baseSort}`;

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
  'tracking_ids',
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
 * Geo query: find issues near a location.
 * Uses PostGIS ST_DWithin + ST_Distance when the location_geog column is
 * populated (post-migration); falls back to the Haversine formula otherwise.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusKm
 * @param {Object} filters  — optional { status, category, urgency }
 * @param {number} limit
 */
export async function findNearby(lat, lng, radiusKm = 10, filters = {}, limit = 50) {
  const radiusMeters = radiusKm * 1000;
  const conditions = [`i.status != 'closed'`];
  const params = [lng, lat, radiusMeters]; // ST_MakePoint takes (lng, lat)
  let idx = 4;

  if (filters.status) {
    conditions.push(`i.status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters.category) {
    conditions.push(`i.category = $${idx++}`);
    params.push(filters.category);
  }
  if (filters.urgency) {
    conditions.push(`i.urgency = $${idx++}`);
    params.push(filters.urgency);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // Try PostGIS first; fall back to Haversine if geography column is unavailable
  let rows;
  try {
    ({ rows } = await pool.query(
      `SELECT ${ISSUE_WITH_JOINS},
         ST_Distance(
           i.location_geog,
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
         ) / 1000.0 AS distance_km
       ${JOIN_CLAUSE}
       ${whereClause}
         AND i.location_geog IS NOT NULL
         AND ST_DWithin(
           i.location_geog,
           ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           $3
         )
       ORDER BY distance_km ASC
       LIMIT ${limit}`,
      params,
    ));
  } catch {
    // PostGIS unavailable — use Haversine fallback
    ({ rows } = await pool.query(
      `SELECT ${ISSUE_WITH_JOINS},
         (6371 * acos(
           cos(radians($2)) * cos(radians(i.location_lat)) *
           cos(radians(i.location_lng) - radians($1)) +
           sin(radians($2)) * sin(radians(i.location_lat))
         )) AS distance_km
       ${JOIN_CLAUSE}
       WHERE i.status != 'closed'
         AND i.location_lat IS NOT NULL
         AND (6371 * acos(
           cos(radians($2)) * cos(radians(i.location_lat)) *
           cos(radians(i.location_lng) - radians($1)) +
           sin(radians($2)) * sin(radians(i.location_lat))
         )) <= ${radiusKm}
       ORDER BY distance_km ASC
       LIMIT ${limit}`,
      [lng, lat],
    ));
  }

  return rows.map((row) => {
    const issue = transformRow(row);
    issue.distanceKm = parseFloat(parseFloat(row.distance_km).toFixed(3));
    return issue;
  });
}

/**
 * Legacy alias — keeps compatibility with existing issueService.getNearbyIssues callers.
 * @deprecated Use findNearby instead.
 */
export async function findByLocation(lat, lng, radiusKm = 10, limit = 50) {
  return findNearby(lat, lng, radiusKm, {}, limit);
}

/**
 * Find issues by administrative jurisdiction (state + optional district).
 * Matches against the district/state text columns.
 *
 * @param {string} stateCode    — two-letter code e.g. 'PB'
 * @param {string} districtCode — district code e.g. 'PB01' (optional)
 * @param {Object} pagination   — { page, limit, sort }
 */
export async function findByJurisdiction(stateCode, districtCode = null, pagination = {}) {
  const { page = 1, limit = 20, sort = 'newest' } = pagination;
  const params = [stateCode.toUpperCase()];
  let idx = 2;

  let districtJoin = '';
  if (districtCode) {
    districtJoin = `AND d_ref.code = $${idx++}`;
    params.push(districtCode.toUpperCase());
  }

  // Join against states/districts tables for code-based lookup
  const sql = `
    SELECT ${ISSUE_WITH_JOINS},
           s_ref.code AS jurisdiction_state_code,
           d_ref.code AS jurisdiction_district_code
    FROM issues i
    LEFT JOIN ministries m            ON i.ministry_id = m.id
    LEFT JOIN departments d           ON i.department_id = d.id
    LEFT JOIN grievance_categories gc ON i.grievance_category_id = gc.id
    LEFT JOIN users u                 ON i.created_by = u.id
    JOIN states s_ref                 ON s_ref.code = $1 AND LOWER(i.state) = LOWER(s_ref.name)
    LEFT JOIN districts d_ref         ON d_ref.state_id = s_ref.id
                                     AND LOWER(i.district) = LOWER(d_ref.name)
                                     ${districtCode ? districtJoin : ''}
    WHERE i.status != 'closed'
    ORDER BY ${
      sort === 'most_supported' ? 'i.supporter_count DESC, i.created_at DESC' : 'i.created_at DESC'
    }
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  const offset = (page - 1) * limit;
  params.push(limit, offset);

  const countParams = params.slice(0, -2);
  const countSql = `
    SELECT COUNT(*) FROM issues i
    JOIN states s_ref ON s_ref.code = $1 AND LOWER(i.state) = LOWER(s_ref.name)
    LEFT JOIN districts d_ref ON d_ref.state_id = s_ref.id
                              AND LOWER(i.district) = LOWER(d_ref.name)
                              ${districtCode ? districtJoin : ''}
    WHERE i.status != 'closed'
  `;

  const [countResult, dataResult] = await Promise.all([
    pool.query(countSql, countParams),
    pool.query(sql, params),
  ]);

  const total = parseInt(countResult.rows[0].count, 10);

  return {
    data: dataResult.rows.map(transformRow),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    jurisdiction: { stateCode: stateCode.toUpperCase(), districtCode: districtCode || null },
  };
}

/**
 * Find issues within a geographic bounding box.
 * Uses PostGIS ST_MakeEnvelope when available, falls back to simple range query.
 *
 * @param {number} minLat
 * @param {number} minLng
 * @param {number} maxLat
 * @param {number} maxLng
 * @param {number} limit
 */
export async function findInBoundingBox(minLat, minLng, maxLat, maxLng, limit = 100) {
  let rows;

  try {
    ({ rows } = await pool.query(
      `SELECT ${ISSUE_WITH_JOINS}
       ${JOIN_CLAUSE}
       WHERE i.status != 'closed'
         AND i.location_geog IS NOT NULL
         AND ST_Within(
           i.location_geog::geometry,
           ST_MakeEnvelope($1, $2, $3, $4, 4326)
         )
       ORDER BY i.supporter_count DESC, i.created_at DESC
       LIMIT $5`,
      [minLng, minLat, maxLng, maxLat, limit],
    ));
  } catch {
    // Fallback: simple lat/lng range filter
    ({ rows } = await pool.query(
      `SELECT ${ISSUE_WITH_JOINS}
       ${JOIN_CLAUSE}
       WHERE i.status != 'closed'
         AND i.location_lat BETWEEN $1 AND $2
         AND i.location_lng BETWEEN $3 AND $4
       ORDER BY i.supporter_count DESC, i.created_at DESC
       LIMIT $5`,
      [minLat, maxLat, minLng, maxLng, limit],
    ));
  }

  return rows.map(transformRow);
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

// ── Feed scoring ─────────────────────────────────────────────────────────────

/**
 * Composite feed score expression (PostgreSQL SQL fragment).
 *
 * Components (weights sum to 1.0):
 *   0.35 — supporter engagement  (log-scaled)
 *   0.15 — story activity        (log-scaled) — ground-reality signal
 *   0.05 — view engagement       (log-scaled)
 *   0.25 — urgency boost         (4=critical … 1=low)
 *   0.10 — location verification (trust signal)
 *   0.10 — recency decay         (half-life ≈ 10 days)
 */
const FEED_SCORE_EXPR = `
  LN(1.0 + i.supporter_count) * 0.35 +
  LN(1.0 + i.story_count)     * 0.15 +
  LN(1.0 + i.view_count)      * 0.05 +
  CASE i.urgency
    WHEN 'critical' THEN 4.0
    WHEN 'high'     THEN 3.0
    WHEN 'medium'   THEN 2.0
    ELSE 1.0
  END * 0.25 +
  CASE WHEN i.is_verified_location THEN 1.0 ELSE 0.0 END * 0.10 +
  1.0 / (1.0 + EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 86400.0 * 0.1) * 0.10
`;

/**
 * Ranked feed with configurable mode.
 *
 * Modes:
 *   trending — scored feed (default), all non-closed issues
 *   nearby   — geo-filtered (requires lat/lng), sorted by feed score
 *   latest   — newest first, feed score still computed for client
 *   critical — urgency IN ('critical','high'), sorted by feed score
 *
 * @param {Object} options
 * @param {string}  options.mode      — trending|nearby|latest|critical
 * @param {Object}  options.filters   — { category, urgency, state, district, isCampaign }
 * @param {number}  [options.lat]     — required for nearby mode
 * @param {number}  [options.lng]     — required for nearby mode
 * @param {number}  [options.radiusKm=20]
 * @param {number}  [options.page=1]
 * @param {number}  [options.limit=20]
 */
export async function findFeed({
  mode = 'trending',
  filters = {},
  lat,
  lng,
  radiusKm = 20,
  page = 1,
  limit = 20,
}) {
  const offset = (page - 1) * limit;
  const conditions = [`i.status != 'closed'`];
  const params = [];
  let idx = 1;

  // ── Common filters ────────────────────────────────────────────────────────
  if (filters.category) {
    conditions.push(`i.category = $${idx++}`);
    params.push(filters.category);
  }
  if (filters.urgency) {
    conditions.push(`i.urgency = $${idx++}`);
    params.push(filters.urgency);
  }
  if (filters.state) {
    conditions.push(`LOWER(i.state) = LOWER($${idx++})`);
    params.push(filters.state);
  }
  if (filters.district) {
    conditions.push(`LOWER(i.district) = LOWER($${idx++})`);
    params.push(filters.district);
  }
  if (filters.isCampaign !== undefined) {
    conditions.push(`i.is_campaign = $${idx++}`);
    params.push(filters.isCampaign);
  }

  // ── Mode-specific conditions ──────────────────────────────────────────────
  if (mode === 'critical') {
    conditions.push(`i.urgency IN ('critical', 'high')`);
  }

  let haversineExpr = null;
  if (mode === 'nearby') {
    const latIdx = idx++;
    const lngIdx = idx++;
    params.push(lat, lng);

    // Haversine distance (km) — LEAST clamps the acos argument to [0,1]
    haversineExpr = `(6371.0 * acos(LEAST(1.0,
      cos(radians($${latIdx})) * cos(radians(i.location_lat)) *
      cos(radians(i.location_lng) - radians($${lngIdx})) +
      sin(radians($${latIdx})) * sin(radians(i.location_lat))
    )))`;

    conditions.push(`i.location_lat IS NOT NULL`);
    conditions.push(`${haversineExpr} <= $${idx++}`);
    params.push(radiusKm);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // ── ORDER BY ──────────────────────────────────────────────────────────────
  // "latest" sorts by age; all other modes sort by computed score.
  const orderBy = mode === 'latest' ? 'i.created_at DESC' : 'feed_score DESC, i.created_at DESC';

  // ── SELECT extra columns ──────────────────────────────────────────────────
  const extraSelect =
    mode === 'nearby'
      ? `, (${FEED_SCORE_EXPR}) AS feed_score, ${haversineExpr} AS distance_km`
      : `, (${FEED_SCORE_EXPR}) AS feed_score`;

  // ── LIMIT / OFFSET indices (always last two params) ───────────────────────
  const limitIdx = idx;
  const offsetIdx = idx + 1;
  const countParams = [...params];
  const dataParams = [...params, limit, offset];

  const [countResult, dataResult] = await Promise.all([
    pool.query(`SELECT COUNT(*) ${JOIN_CLAUSE} ${whereClause}`, countParams),
    pool.query(
      `SELECT ${ISSUE_WITH_JOINS} ${extraSelect}
       ${JOIN_CLAUSE} ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      dataParams,
    ),
  ]);

  const total = parseInt(countResult.rows[0].count, 10);

  return {
    data: dataResult.rows.map((row) => {
      const issue = transformRow(row);
      issue.feedScore = parseFloat(parseFloat(row.feed_score).toFixed(4));
      if (mode === 'nearby' && row.distance_km != null) {
        issue.distanceKm = parseFloat(parseFloat(row.distance_km).toFixed(3));
      }
      return issue;
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    meta: {
      mode,
      ...(mode === 'nearby' ? { lat, lng, radiusKm } : {}),
    },
  };
}

/**
 * Find issues related to a given issue by same category or district.
 * Sorted by supporter count descending; excludes the source issue and closed issues.
 *
 * @param {string} id        — source issue UUID
 * @param {Object} opts
 * @param {string} opts.category
 * @param {string} opts.district
 * @param {number} [opts.limit=3]
 */
export async function findRelated(id, { category, district, limit = 3 }) {
  const conditions = [`i.id != $1`, `i.status != 'closed'`];
  const params = [id];
  let idx = 2;

  const categoryConditions = [];
  if (category) {
    categoryConditions.push(`i.category = $${idx++}`);
    params.push(category);
  }
  if (district) {
    categoryConditions.push(`LOWER(i.district) = LOWER($${idx++})`);
    params.push(district);
  }

  if (categoryConditions.length) {
    conditions.push(`(${categoryConditions.join(' OR ')})`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  params.push(limit);

  const { rows } = await pool.query(
    `SELECT ${ISSUE_WITH_JOINS}
     ${JOIN_CLAUSE}
     ${whereClause}
     ORDER BY i.supporter_count DESC, i.created_at DESC
     LIMIT $${idx}`,
    params,
  );
  return rows.map(transformRow);
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
