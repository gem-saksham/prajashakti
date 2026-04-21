/**
 * Location model — states and districts lookup tables.
 * All methods return camelCase objects.
 */

import pool from '../db/postgres.js';
import { toCamelCase } from '../utils/transform.js';

// ─── States ──────────────────────────────────────────────────────────────────

/**
 * List all active states/UTs, optionally filtered by type.
 * @param {{ type?: 'state'|'ut' }} filters
 */
export async function listStates(filters = {}) {
  const params = [];
  let whereClause = 'WHERE is_active = true';

  if (filters.type) {
    whereClause += ' AND type = $1';
    params.push(filters.type);
  }

  const { rows } = await pool.query(
    `SELECT id, code, name, type, lgd_code, is_active, created_at
     FROM states
     ${whereClause}
     ORDER BY name`,
    params,
  );

  return rows.map(toCamelCase);
}

/**
 * Get a single state by its two-letter code (case-insensitive).
 */
export async function getStateByCode(code) {
  const { rows } = await pool.query(
    `SELECT id, code, name, type, lgd_code, is_active
     FROM states
     WHERE code = $1 AND is_active = true`,
    [code.toUpperCase()],
  );
  return rows.length ? toCamelCase(rows[0]) : null;
}

/**
 * Get a single state by its canonical name (case-insensitive).
 */
export async function getStateByName(name) {
  const { rows } = await pool.query(
    `SELECT id, code, name, type, lgd_code, is_active
     FROM states
     WHERE LOWER(name) = LOWER($1) AND is_active = true`,
    [name],
  );
  return rows.length ? toCamelCase(rows[0]) : null;
}

// ─── Districts ────────────────────────────────────────────────────────────────

/**
 * List all active districts for a state (identified by its code).
 */
export async function listDistrictsByStateCode(stateCode) {
  const { rows } = await pool.query(
    `SELECT d.id, d.code, d.name, d.lgd_code, d.is_active, s.code AS state_code
     FROM districts d
     JOIN states s ON d.state_id = s.id
     WHERE s.code = $1
       AND d.is_active = true
       AND s.is_active = true
     ORDER BY d.name`,
    [stateCode.toUpperCase()],
  );
  return rows.map(toCamelCase);
}

/**
 * Get a single district by its code within a state.
 */
export async function getDistrictByCode(stateCode, districtCode) {
  const { rows } = await pool.query(
    `SELECT d.id, d.code, d.name, d.lgd_code, s.code AS state_code, s.name AS state_name
     FROM districts d
     JOIN states s ON d.state_id = s.id
     WHERE s.code = $1 AND d.code = $2
       AND d.is_active = true`,
    [stateCode.toUpperCase(), districtCode.toUpperCase()],
  );
  if (!rows.length) return null;
  const r = toCamelCase(rows[0]);
  r.state = { code: r.stateCode, name: r.stateName };
  delete r.stateName;
  return r;
}

/**
 * Find a district by name within a state (case-insensitive, partial match).
 */
export async function findDistrictByName(stateCode, districtName) {
  const { rows } = await pool.query(
    `SELECT d.id, d.code, d.name, d.lgd_code, s.code AS state_code, s.name AS state_name
     FROM districts d
     JOIN states s ON d.state_id = s.id
     WHERE s.code = $1
       AND LOWER(d.name) = LOWER($2)
       AND d.is_active = true`,
    [stateCode.toUpperCase(), districtName],
  );
  if (!rows.length) return null;
  const r = toCamelCase(rows[0]);
  r.state = { code: r.stateCode, name: r.stateName };
  delete r.stateName;
  return r;
}

/**
 * Full-text search districts across all states using GIN index.
 */
export async function searchDistricts(query, stateCode = null) {
  const params = [query];
  let stateFilter = '';

  if (stateCode) {
    stateFilter = 'AND s.code = $2';
    params.push(stateCode.toUpperCase());
  }

  const { rows } = await pool.query(
    `SELECT d.id, d.code, d.name, d.lgd_code, s.code AS state_code, s.name AS state_name
     FROM districts d
     JOIN states s ON d.state_id = s.id
     WHERE d.is_active = true
       AND to_tsvector('english', d.name) @@ plainto_tsquery('english', $1)
       ${stateFilter}
     ORDER BY ts_rank(to_tsvector('english', d.name), plainto_tsquery('english', $1)) DESC
     LIMIT 10`,
    params,
  );

  return rows.map((row) => {
    const r = toCamelCase(row);
    r.state = { code: r.stateCode, name: r.stateName };
    delete r.stateName;
    return r;
  });
}
