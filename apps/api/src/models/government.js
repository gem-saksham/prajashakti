/**
 * Government model — query layer for CPGRAMS taxonomy.
 * Covers ministries, departments, and grievance categories.
 * All methods return camelCase objects.
 */

import pool from '../db/postgres.js';
import { toCamelCase } from '../utils/transform.js';

// ─── Ministries ──────────────────────────────────────────────────────────────

/**
 * List ministries with optional type filter.
 * @param {Object} filters - { type: 'central'|'state'|'ut', isActive }
 */
export async function listMinistries(filters = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.type) {
    conditions.push(`type = $${idx++}`);
    params.push(filters.type);
  }
  if (filters.isActive !== undefined) {
    conditions.push(`is_active = $${idx++}`);
    params.push(filters.isActive);
  } else {
    conditions.push('is_active = true');
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT id, code, name, type, state_code, website, cpgrams_code, is_active, created_at
     FROM ministries ${whereClause}
     ORDER BY type, name`,
    params,
  );

  return rows.map(toCamelCase);
}

/**
 * Get a single ministry by ID.
 */
export async function getMinistryById(id) {
  const { rows } = await pool.query(
    `SELECT id, code, name, type, state_code, website, cpgrams_code, is_active, created_at
     FROM ministries WHERE id = $1`,
    [id],
  );
  return rows.length ? toCamelCase(rows[0]) : null;
}

/**
 * Full-text search on ministry name.
 * Uses ILIKE for simplicity; could upgrade to ts_vector for production-scale search.
 */
export async function searchMinistries(query) {
  const { rows } = await pool.query(
    `SELECT id, code, name, type, state_code, website, cpgrams_code
     FROM ministries
     WHERE is_active = true AND name ILIKE $1
     ORDER BY name
     LIMIT 20`,
    [`%${query}%`],
  );
  return rows.map(toCamelCase);
}

/**
 * Get ministry by state code (for auto-routing by user location).
 */
export async function getMinistryByStateCode(stateCode) {
  const { rows } = await pool.query(
    `SELECT id, code, name, type, state_code, website
     FROM ministries
     WHERE state_code = $1 AND is_active = true`,
    [stateCode],
  );
  return rows.length ? toCamelCase(rows[0]) : null;
}

// ─── Departments ─────────────────────────────────────────────────────────────

/**
 * List departments under a specific ministry.
 */
export async function listDepartments(ministryId) {
  const { rows } = await pool.query(
    `SELECT d.id, d.code, d.name, d.nodal_officer_title, d.public_email, d.public_phone,
            d.jurisdiction_type, d.jurisdiction_code, d.cpgrams_code,
            d.resolution_sla_days, d.parent_department_id, d.is_active
     FROM departments d
     WHERE d.ministry_id = $1 AND d.is_active = true
     ORDER BY d.name`,
    [ministryId],
  );
  return rows.map(toCamelCase);
}

/**
 * Get a single department by ID, with ministry info.
 */
export async function getDepartmentById(id) {
  const { rows } = await pool.query(
    `SELECT d.id, d.code, d.name, d.nodal_officer_title, d.public_email, d.public_phone,
            d.jurisdiction_type, d.jurisdiction_code, d.cpgrams_code,
            d.resolution_sla_days, d.parent_department_id, d.is_active,
            m.id AS ministry_id, m.code AS ministry_code, m.name AS ministry_name, m.type AS ministry_type
     FROM departments d
     JOIN ministries m ON d.ministry_id = m.id
     WHERE d.id = $1`,
    [id],
  );
  if (!rows.length) return null;

  const row = toCamelCase(rows[0]);
  row.ministry = {
    id: row.ministryId,
    code: row.ministryCode,
    name: row.ministryName,
    type: row.ministryType,
  };
  delete row.ministryCode;
  delete row.ministryName;
  delete row.ministryType;

  return row;
}

/**
 * Search departments across all ministries.
 */
export async function searchDepartments(query) {
  const { rows } = await pool.query(
    `SELECT d.id, d.code, d.name, d.jurisdiction_type, d.jurisdiction_code,
            m.name AS ministry_name, m.code AS ministry_code
     FROM departments d
     JOIN ministries m ON d.ministry_id = m.id
     WHERE d.is_active = true
       AND (d.name ILIKE $1 OR m.name ILIKE $1)
     ORDER BY d.name
     LIMIT 30`,
    [`%${query}%`],
  );

  return rows.map((row) => {
    const r = toCamelCase(row);
    r.ministry = { name: r.ministryName, code: r.ministryCode };
    delete r.ministryName;
    delete r.ministryCode;
    return r;
  });
}

/**
 * List departments by jurisdiction (e.g., all state-level departments for Punjab).
 */
export async function listDepartmentsByJurisdiction(jurisdictionType, jurisdictionCode) {
  const { rows } = await pool.query(
    `SELECT d.id, d.code, d.name, d.nodal_officer_title, d.resolution_sla_days,
            m.name AS ministry_name, m.code AS ministry_code
     FROM departments d
     JOIN ministries m ON d.ministry_id = m.id
     WHERE d.is_active = true
       AND d.jurisdiction_type = $1
       AND d.jurisdiction_code = $2
     ORDER BY d.name`,
    [jurisdictionType, jurisdictionCode],
  );

  return rows.map((row) => {
    const r = toCamelCase(row);
    r.ministry = { name: r.ministryName, code: r.ministryCode };
    delete r.ministryName;
    delete r.ministryCode;
    return r;
  });
}

// ─── Grievance Categories ────────────────────────────────────────────────────

/**
 * List grievance categories, optionally filtered by PrajaShakti category.
 */
export async function listGrievanceCategories(prajaCategory) {
  const params = [];
  let whereClause = 'WHERE gc.is_active = true';

  if (prajaCategory) {
    whereClause += ' AND gc.praja_category = $1';
    params.push(prajaCategory);
  }

  const { rows } = await pool.query(
    `SELECT gc.id, gc.name, gc.slug, gc.praja_category, gc.cpgrams_category_code,
            gc.description, gc.keywords, gc.parent_category_id,
            d.name AS default_department_name, d.code AS default_department_code
     FROM grievance_categories gc
     LEFT JOIN departments d ON gc.default_department_id = d.id
     ${whereClause}
     ORDER BY gc.praja_category, gc.name`,
    params,
  );

  return rows.map((row) => {
    const r = toCamelCase(row);
    if (r.defaultDepartmentName) {
      r.defaultDepartment = { name: r.defaultDepartmentName, code: r.defaultDepartmentCode };
    } else {
      r.defaultDepartment = null;
    }
    delete r.defaultDepartmentName;
    delete r.defaultDepartmentCode;
    return r;
  });
}

/**
 * Match keywords against input text for NLP fallback category suggestion.
 * Returns categories ranked by number of keyword matches.
 */
export async function findCategoryByKeywords(text) {
  const { rows } = await pool.query(
    `SELECT gc.id, gc.name, gc.slug, gc.praja_category, gc.cpgrams_category_code,
            gc.keywords, gc.description,
            d.name AS default_department_name,
            (SELECT COUNT(*)
             FROM unnest(gc.keywords) AS kw
             WHERE $1 ILIKE '%' || kw || '%'
            ) AS match_count
     FROM grievance_categories gc
     LEFT JOIN departments d ON gc.default_department_id = d.id
     WHERE gc.is_active = true
       AND (SELECT COUNT(*)
            FROM unnest(gc.keywords) AS kw
            WHERE $1 ILIKE '%' || kw || '%') > 0
     ORDER BY match_count DESC
     LIMIT 5`,
    [text],
  );

  return rows.map((row) => {
    const r = toCamelCase(row);
    r.matchCount = parseInt(row.match_count, 10);
    r.defaultDepartment = r.defaultDepartmentName ? { name: r.defaultDepartmentName } : null;
    delete r.defaultDepartmentName;
    return r;
  });
}

/**
 * Get a single grievance category by slug.
 */
export async function getCategoryBySlug(slug) {
  const { rows } = await pool.query(
    `SELECT gc.id, gc.name, gc.slug, gc.praja_category, gc.cpgrams_category_code,
            gc.description, gc.keywords, gc.parent_category_id,
            gc.default_department_id,
            d.name AS default_department_name, d.code AS default_department_code
     FROM grievance_categories gc
     LEFT JOIN departments d ON gc.default_department_id = d.id
     WHERE gc.slug = $1`,
    [slug],
  );

  if (!rows.length) return null;
  const r = toCamelCase(rows[0]);
  r.defaultDepartment = r.defaultDepartmentName
    ? { id: r.defaultDepartmentId, name: r.defaultDepartmentName, code: r.defaultDepartmentCode }
    : null;
  delete r.defaultDepartmentName;
  delete r.defaultDepartmentCode;
  return r;
}
