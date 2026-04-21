/**
 * Tag Suggestion Service — keyword-based category/department/official suggestions.
 *
 * Phase 1: Keyword matching against grievance_categories.keywords[] with TF-IDF-like scoring.
 * Phase 2 Sprint 9: Replace with NLP classification model, keeping the same interface.
 *
 * Cache suggestions in Redis keyed on a SHA-256 hash of the normalised input.
 */

import { createHash } from 'crypto';
import * as GovModel from '../models/government.js';
import * as OfficialModel from '../models/official.js';
import { findResponsibleDepartments } from './locationService.js';
import pool from '../db/postgres.js';

const SUGGESTION_TTL = 600; // 10 minutes

// ── Cache key ─────────────────────────────────────────────────────────────────

function suggestionCacheKey(title, description, category, lat, lng) {
  const text = [
    (title || '').toLowerCase().trim(),
    (description || '').substring(0, 200).toLowerCase().trim(),
    (category || '').toLowerCase(),
    lat != null ? parseFloat(lat).toFixed(2) : '',
    lng != null ? parseFloat(lng).toFixed(2) : '',
  ].join('|');

  return `suggest:${createHash('sha256').update(text).digest('hex').slice(0, 12)}`;
}

// ── 1. Grievance Category Suggestion ─────────────────────────────────────────

/**
 * Match title + description against grievance_categories.keywords[] stored in the DB.
 * The categories table already has keywords[], and the existing findCategoryByKeywords()
 * query counts keyword hits. We extend it with a confidence ratio.
 *
 * @param {string} title
 * @param {string} description
 * @param {string|null} prajaCategory  — PrajaShakti category ("Infrastructure", etc.)
 * @returns {Array<{ id, name, slug, prajaCategory, confidence }>}
 */
export async function suggestGrievanceCategory(title, description, prajaCategory = null) {
  const text = `${title || ''} ${description || ''}`.trim();
  if (!text) return [];

  // Use the SQL keyword-matching query from GovModel, extended with category filter
  const params = [text];
  let catFilter = '';
  if (prajaCategory) {
    catFilter = 'AND gc.praja_category = $2';
    params.push(prajaCategory);
  }

  const { rows } = await pool.query(
    `SELECT gc.id, gc.name, gc.slug, gc.praja_category, gc.cpgrams_category_code,
            gc.keywords,
            (SELECT COUNT(*)
             FROM unnest(gc.keywords) AS kw
             WHERE $1 ILIKE '%' || kw || '%'
            ) AS match_count,
            array_length(gc.keywords, 1) AS keyword_total
     FROM grievance_categories gc
     WHERE gc.is_active = true
       ${catFilter}
       AND (SELECT COUNT(*)
            FROM unnest(gc.keywords) AS kw
            WHERE $1 ILIKE '%' || kw || '%') > 0
     ORDER BY match_count DESC
     LIMIT 10`,
    params,
  );

  return rows
    .map((row) => {
      const matchCount = parseInt(row.match_count, 10);
      const keywordTotal = parseInt(row.keyword_total, 10) || 1;
      // Confidence: fraction of category keywords matched, capped at 1
      const confidence = Math.min(1, matchCount / Math.max(1, Math.ceil(keywordTotal * 0.4)));

      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        prajaCategory: row.praja_category,
        cpgramsCode: row.cpgrams_category_code,
        confidence: parseFloat(confidence.toFixed(2)),
        matchedKeywords: matchCount,
      };
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

// ── 2. Department Suggestion ──────────────────────────────────────────────────

/**
 * Suggest responsible departments by combining:
 *  a) The default_department_id of the matched grievance category
 *  b) Location-based findResponsibleDepartments (from Day 19)
 *
 * Returns a de-duplicated ranked list with source metadata.
 *
 * @param {object} redis
 * @param {number|null} lat
 * @param {number|null} lng
 * @param {string|null} prajaCategory
 * @param {string|null} grievanceCategoryId
 */
export async function suggestDepartment(redis, lat, lng, prajaCategory, grievanceCategoryId) {
  const results = [];
  const seenIds = new Set();

  // a) Category default department (highest-priority — most specific)
  if (grievanceCategoryId) {
    const { rows } = await pool.query(
      `SELECT d.id, d.code, d.name, d.jurisdiction_type, d.jurisdiction_code,
              d.nodal_officer_title, d.resolution_sla_days,
              m.id AS ministry_id, m.name AS ministry_name, m.code AS ministry_code
       FROM grievance_categories gc
       JOIN departments d ON gc.default_department_id = d.id
       JOIN ministries m ON d.ministry_id = m.id
       WHERE gc.id = $1 AND d.is_active = true`,
      [grievanceCategoryId],
    );

    for (const row of rows) {
      if (!seenIds.has(row.id)) {
        seenIds.add(row.id);
        results.push({
          department: {
            id: row.id,
            code: row.code,
            name: row.name,
            jurisdictionType: row.jurisdiction_type,
            jurisdictionCode: row.jurisdiction_code,
            nodalOfficerTitle: row.nodal_officer_title,
            resolutionSlaDays: row.resolution_sla_days,
            ministry: { id: row.ministry_id, name: row.ministry_name, code: row.ministry_code },
          },
          reason: 'default_for_category',
          priority: 1,
        });
      }
    }
  }

  // b) Location-based departments (district → state → national)
  if (lat != null && lng != null && redis) {
    try {
      const locationDepts = await findResponsibleDepartments(redis, lat, lng, prajaCategory);
      for (const item of locationDepts) {
        const deptId = item.department?.id;
        if (deptId && !seenIds.has(deptId)) {
          seenIds.add(deptId);
          results.push({
            department: item.department,
            reason: `location_${item.jurisdictionLevel}`,
            priority:
              item.jurisdictionLevel === 'district'
                ? 2
                : item.jurisdictionLevel === 'state'
                  ? 3
                  : 4,
          });
        }
      }
    } catch {
      // Non-fatal: location service unavailable
    }
  }

  return results.sort((a, b) => a.priority - b.priority);
}

// ── 3. Official Suggestion (stub) ─────────────────────────────────────────────

/**
 * Suggest officials responsible for a department + jurisdiction.
 * Phase 1: returns the nodal officer title from the department.
 * Phase 2 Sprint 7: DoPT data will populate real officer records.
 *
 * @param {string|null} departmentId
 * @param {string|null} stateCode
 */
export async function suggestOfficials(departmentId, stateCode = null) {
  if (!departmentId) return [];

  // Try to find real officials from the DB
  const officials = await OfficialModel.findByDepartmentAndJurisdiction(departmentId, stateCode);
  if (officials.length > 0) {
    return officials.map((o) => ({
      id: o.id,
      name: o.name,
      designation: o.designation,
      department: o.department?.name || null,
      stateCode: o.stateCode,
      isReal: true,
    }));
  }

  // Fallback: return the nodal officer title from the department schema
  const { rows } = await pool.query(
    `SELECT nodal_officer_title, name AS dept_name FROM departments WHERE id = $1`,
    [departmentId],
  );

  if (!rows.length || !rows[0].nodal_officer_title) return [];

  return [
    {
      id: null,
      name: null,
      designation: rows[0].nodal_officer_title,
      department: rows[0].dept_name,
      stateCode: stateCode || null,
      isReal: false,
    },
  ];
}

// ── 4. Orchestrator ───────────────────────────────────────────────────────────

/**
 * Auto-suggest all tags for an issue.
 * Returns grievanceCategories, ministries, departments, suggestedOfficials.
 * Caches results for 10 minutes.
 *
 * @param {object} issueData  — { title, description, category, locationLat, locationLng }
 * @param {object} redis      — ioredis instance
 */
export async function autoSuggest(issueData, redis) {
  const { title, description, category, locationLat, locationLng } = issueData;

  const cacheKey = suggestionCacheKey(title, description, category, locationLat, locationLng);

  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  // 1. Grievance categories
  const grievanceCategories = await suggestGrievanceCategory(title, description, category);

  // 2. Best grievance category ID for subsequent lookups
  const topCategoryId = grievanceCategories[0]?.id || null;

  // 3. Department suggestions
  const departmentSuggestions = await suggestDepartment(
    redis,
    locationLat ?? null,
    locationLng ?? null,
    category,
    topCategoryId,
  );

  // 4. Deduplicate ministries from suggested departments
  const ministryMap = new Map();
  for (const item of departmentSuggestions) {
    const m = item.department?.ministry;
    if (m && !ministryMap.has(m.id)) {
      ministryMap.set(m.id, { id: m.id, name: m.name, code: m.code, reason: item.reason });
    }
  }
  const ministries = Array.from(ministryMap.values());

  // 5. Officials for the top department
  const topDeptId = departmentSuggestions[0]?.department?.id || null;
  const stateCode = null; // TODO: extract from jurisdiction when lat/lng provided
  const suggestedOfficials = await suggestOfficials(topDeptId, stateCode);

  const result = {
    grievanceCategories,
    ministries,
    departments: departmentSuggestions.map((d) => ({
      ...d.department,
      reason: d.reason,
    })),
    suggestedOfficials,
  };

  if (redis) {
    redis.setex(cacheKey, SUGGESTION_TTL, JSON.stringify(result)).catch(() => {});
  }

  return result;
}
