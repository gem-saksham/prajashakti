/**
 * Issue Service — business logic layer.
 *
 * Routes call this; this calls IssueModel + GovModel.
 * No raw SQL here. No HTTP reply objects here.
 * ServiceError(statusCode, code, message) for all business-rule failures.
 */

import * as IssueModel from '../models/issue.js';
import * as GovModel from '../models/government.js';
import * as OfficialModel from '../models/official.js';
import { logActivity } from '../models/userActivity.js';
import { ServiceError } from './userService.js';
import { toSnakeCase } from '../utils/transform.js';
import { issueListCacheKey, issueCacheKey, ISSUE_STATS_KEY } from '../utils/cacheKey.js';
import { reverseGeocode } from './locationService.js';
import { isWithinIndia } from '../utils/locationValidator.js';
import pool from '../db/postgres.js';

// Cache TTLs (seconds)
const LIST_TTL = 60; // 1 min — list pages are cheap to regenerate
const SINGLE_TTL = 120; // 2 min — individual issues
const STATS_TTL = 300; // 5 min — aggregate stats

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Validate that optional taxonomy IDs actually exist in the DB.
 * Throws 400 if any referenced entity is not found.
 */
async function validateTaxonomyIds({ ministryId, departmentId, grievanceCategoryId }) {
  if (ministryId) {
    const m = await GovModel.getMinistryById(ministryId);
    if (!m) throw new ServiceError(400, 'INVALID_MINISTRY', 'Ministry not found');
  }
  if (departmentId) {
    const d = await GovModel.getDepartmentById(departmentId);
    if (!d) throw new ServiceError(400, 'INVALID_DEPARTMENT', 'Department not found');
  }
  if (grievanceCategoryId) {
    const { rows } = await pool.query(
      'SELECT id FROM grievance_categories WHERE id = $1 AND is_active = true',
      [grievanceCategoryId],
    );
    if (!rows.length) {
      throw new ServiceError(400, 'INVALID_CATEGORY', 'Grievance category not found');
    }
  }
}

/**
 * Convert snake_case request body keys to camelCase for the model layer.
 * Only maps known fields; unknown fields are silently dropped.
 */
function normalizeInput(body) {
  return {
    title: body.title,
    description: body.description,
    category: body.category,
    urgency: body.urgency,
    locationLat: body.location_lat,
    locationLng: body.location_lng,
    district: body.district,
    state: body.state,
    pincode: body.pincode,
    formattedAddress: body.formatted_address,
    photos: body.photos,
    ministryId: body.ministry_id,
    departmentId: body.department_id,
    grievanceCategoryId: body.grievance_category_id,
    officialName: body.official_name,
    officialDesignation: body.official_designation,
    officialDepartment: body.official_department,
    isAnonymous: body.is_anonymous,
    targetSupporters: body.target_supporters,
    campaignDeadline: body.campaign_deadline,
    resolutionNotes: body.resolution_notes,
    // Official IDs to tag immediately after creation
    suggestedOfficialIds: Array.isArray(body.suggested_official_ids)
      ? body.suggested_official_ids
      : [],
  };
}

/**
 * Normalise update fields: snake_case body → camelCase model keys.
 * The update model expects column names (snake_case) for UPDATABLE_FIELDS,
 * so we keep snake_case here — the model does the whitelisting.
 */
function normalizeUpdateInput(body) {
  const out = {};
  const mapping = {
    title: 'title',
    description: 'description',
    category: 'category',
    urgency: 'urgency',
    district: 'district',
    state: 'state',
    pincode: 'pincode',
    formatted_address: 'formatted_address',
    photos: 'photos',
    ministry_id: 'ministry_id',
    department_id: 'department_id',
    grievance_category_id: 'grievance_category_id',
    official_name: 'official_name',
    official_designation: 'official_designation',
    official_department: 'official_department',
    is_anonymous: 'is_anonymous',
    target_supporters: 'target_supporters',
    campaign_deadline: 'campaign_deadline',
    resolution_notes: 'resolution_notes',
    tracking_ids: 'tracking_ids',
  };
  for (const [k, v] of Object.entries(body)) {
    if (mapping[k]) out[mapping[k]] = v;
  }
  return out;
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Create a new issue.
 * Validates taxonomy IDs, auto-geocodes if district/state are missing,
 * enforces India bounding box, inserts, logs activity.
 *
 * @param {string} userId
 * @param {object} body   — snake_case request body
 * @param {object} redis  — ioredis instance (for geocode caching)
 */
export async function createIssue(userId, body, redis = null) {
  const data = normalizeInput(body);

  // Validate coordinates are within India
  if (data.locationLat != null && data.locationLng != null) {
    if (!isWithinIndia(data.locationLat, data.locationLng)) {
      throw new ServiceError(400, 'INVALID_LOCATION', 'Coordinates are outside India');
    }

    // Auto-geocode: fill district/state/pincode/formattedAddress if missing
    if (!data.district || !data.state) {
      try {
        const geo = redis ? await reverseGeocode(redis, data.locationLat, data.locationLng) : null;
        if (geo) {
          if (!data.district && geo.district) data.district = geo.district;
          if (!data.state && geo.state) data.state = geo.state;
          if (!data.pincode && geo.pincode) data.pincode = geo.pincode;
          if (!data.formattedAddress && geo.formattedAddress) {
            data.formattedAddress = geo.formattedAddress;
          }
        }
      } catch {
        // Non-fatal: geocoding failure should not block issue creation
      }
    }
  }

  await validateTaxonomyIds({
    ministryId: data.ministryId,
    departmentId: data.departmentId,
    grievanceCategoryId: data.grievanceCategoryId,
  });

  data.createdBy = userId;

  const issue = await IssueModel.create(data);

  // Tag suggested officials — fire-and-forget (non-fatal)
  if (data.suggestedOfficialIds.length > 0) {
    Promise.all(
      data.suggestedOfficialIds.map((officialId) =>
        OfficialModel.tagToIssue(issue.id, officialId, userId, 'primary')
          .then(() => OfficialModel.incrementTaggedCount(officialId))
          .catch(() => {}),
      ),
    ).catch(() => {});
  }

  // Fire-and-forget activity log
  logActivity(userId, 'issue_created', 'issue', issue.id, {
    category: issue.category,
    district: issue.district,
    state: issue.state,
  }).catch(() => {});

  return issue;
}

/**
 * Fetch a single issue by ID.
 * Increments view count for non-owners (fire-and-forget).
 *
 * @param {string}      id       — Issue UUID
 * @param {string|null} viewerId — Authenticated user's ID (or null for guests)
 * @param {object}      redis    — ioredis instance for caching
 */
export async function getIssue(id, viewerId, redis) {
  // Try cache first
  const cacheKey = issueCacheKey(id);
  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  const issue = await IssueModel.findById(id);
  if (!issue) throw new ServiceError(404, 'ISSUE_NOT_FOUND', 'Issue not found');

  // Increment view count for non-owners (fire-and-forget)
  if (!viewerId || viewerId !== issue.createdBy) {
    IssueModel.incrementCounter(id, 'view_count').catch(() => {});
  }

  // Cache for SINGLE_TTL
  if (redis) {
    redis.setex(cacheKey, SINGLE_TTL, JSON.stringify(issue)).catch(() => {});
  }

  return issue;
}

/**
 * Paginated issue list with filters and Redis cache.
 */
export async function listIssues(filters, pagination, redis) {
  const { page = 1, limit = 20, sort = 'newest' } = pagination;

  const cacheKey = issueListCacheKey({ ...filters, sort }, page, limit);
  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  const result = await IssueModel.findAll(filters, { page, limit, sort });

  if (redis) {
    redis.setex(cacheKey, LIST_TTL, JSON.stringify(result)).catch(() => {});
  }

  return result;
}

/**
 * Update an issue.
 * Only the creator (or admin) may update. Clears the single-issue cache.
 */
export async function updateIssue(id, userId, userRole, body, redis) {
  const issue = await IssueModel.findById(id);
  if (!issue) throw new ServiceError(404, 'ISSUE_NOT_FOUND', 'Issue not found');

  if (issue.createdBy !== userId && userRole !== 'admin') {
    throw new ServiceError(403, 'FORBIDDEN', 'You can only edit your own issues');
  }

  if (issue.status === 'closed') {
    throw new ServiceError(400, 'ISSUE_CLOSED', 'Closed issues cannot be edited');
  }

  const updates = normalizeUpdateInput(body);

  // Validate taxonomy IDs if they are being changed
  await validateTaxonomyIds({
    ministryId: updates.ministry_id,
    departmentId: updates.department_id,
    grievanceCategoryId: updates.grievance_category_id,
  });

  const updated = await IssueModel.update(id, updates);

  // Invalidate cache
  if (redis) {
    redis.del(issueCacheKey(id)).catch(() => {});
  }

  return updated;
}

/**
 * Soft-delete an issue (sets status = 'closed').
 * Only the creator (or admin) may delete.
 */
export async function deleteIssue(id, userId, userRole, redis) {
  const issue = await IssueModel.findById(id);
  if (!issue) throw new ServiceError(404, 'ISSUE_NOT_FOUND', 'Issue not found');

  if (issue.createdBy !== userId && userRole !== 'admin') {
    throw new ServiceError(403, 'FORBIDDEN', 'You can only delete your own issues');
  }

  const result = await IssueModel.softDelete(id);

  // Invalidate cache
  if (redis) {
    redis.del(issueCacheKey(id)).catch(() => {});
  }

  return result;
}

/**
 * Get issues created by a specific user (for "My Issues" screen).
 */
export async function getMyIssues(userId, pagination) {
  const { page = 1, limit = 20, sort = 'newest' } = pagination;
  return IssueModel.findAll({ createdBy: userId, status: undefined }, { page, limit, sort });
}

/**
 * Find issues near a GPS location.
 * Uses PostGIS ST_DWithin when available; falls back to Haversine.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusKm
 * @param {number} limit
 * @param {Object} filters  — optional { category, urgency }
 */
export async function getNearbyIssues(lat, lng, radiusKm = 10, limit = 50, filters = {}) {
  if (!isWithinIndia(lat, lng)) {
    throw new ServiceError(400, 'INVALID_LOCATION', 'Coordinates are outside India');
  }
  return IssueModel.findNearby(lat, lng, radiusKm, filters, limit);
}

/**
 * Find issues by administrative jurisdiction.
 *
 * @param {string} stateCode
 * @param {string|null} districtCode
 * @param {Object} pagination
 */
export async function getIssuesByJurisdiction(stateCode, districtCode, pagination) {
  return IssueModel.findByJurisdiction(stateCode, districtCode, pagination);
}

/**
 * Find issues within a geographic bounding box.
 */
export async function getIssuesInBoundingBox(minLat, minLng, maxLat, maxLng, limit = 100) {
  if (!isWithinIndia(minLat, minLng) && !isWithinIndia(maxLat, maxLng)) {
    throw new ServiceError(400, 'INVALID_LOCATION', 'Bounding box is outside India');
  }
  return IssueModel.findInBoundingBox(minLat, minLng, maxLat, maxLng, limit);
}

/**
 * Aggregate statistics across all issues.
 * Cached for STATS_TTL.
 */
export async function getIssueStats(redis) {
  if (redis) {
    const cached = await redis.get(ISSUE_STATS_KEY);
    if (cached) return JSON.parse(cached);
  }

  const { rows } = await pool.query(`
    SELECT
      COUNT(*)                                                          AS total,
      COUNT(*) FILTER (WHERE status = 'active')                        AS active,
      COUNT(*) FILTER (WHERE status = 'trending')                      AS trending,
      COUNT(*) FILTER (WHERE status = 'escalated')                     AS escalated,
      COUNT(*) FILTER (WHERE status IN (
        'officially_resolved', 'citizen_verified_resolved'))           AS resolved,
      COUNT(*) FILTER (WHERE status = 'closed')                        AS closed,
      COUNT(*) FILTER (WHERE urgency = 'critical')                     AS critical,
      COUNT(*) FILTER (WHERE is_campaign = true)                       AS campaigns,
      COALESCE(SUM(supporter_count), 0)                                AS total_supporters,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS last_24h,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')   AS last_7d
    FROM issues
  `);

  const stats = {
    total: parseInt(rows[0].total, 10),
    byStatus: {
      active: parseInt(rows[0].active, 10),
      trending: parseInt(rows[0].trending, 10),
      escalated: parseInt(rows[0].escalated, 10),
      resolved: parseInt(rows[0].resolved, 10),
      closed: parseInt(rows[0].closed, 10),
    },
    critical: parseInt(rows[0].critical, 10),
    campaigns: parseInt(rows[0].campaigns, 10),
    totalSupporters: parseInt(rows[0].total_supporters, 10),
    recentActivity: {
      last24h: parseInt(rows[0].last_24h, 10),
      last7d: parseInt(rows[0].last_7d, 10),
    },
  };

  if (redis) {
    redis.setex(ISSUE_STATS_KEY, STATS_TTL, JSON.stringify(stats)).catch(() => {});
  }

  return stats;
}

/**
 * Return up to `limit` issues related to the given issue.
 * Matches on same category OR same district.
 * Throws 404 if the source issue does not exist.
 *
 * @param {string} id      — UUID of the source issue
 * @param {number} limit   — max results (default 3)
 */
export async function getRelatedIssues(id, limit = 3) {
  const issue = await IssueModel.findById(id);
  if (!issue) throw new ServiceError(404, 'ISSUE_NOT_FOUND', 'Issue not found');

  return IssueModel.findRelated(id, {
    category: issue.category,
    district: issue.district,
    limit,
  });
}
