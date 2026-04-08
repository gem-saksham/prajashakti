/**
 * User model — thin DB query layer.
 * All methods accept and return camelCase objects.
 * Raw SQL goes here; business logic lives in userService.js.
 */

import pool from '../db/postgres.js';
import { toCamelCase } from '../utils/transform.js';

// Columns safe to return for the authenticated user's own profile
const PRIVATE_COLS = `
  id, phone, name, email, email_verified, google_id, bio, avatar_url,
  location_lat, location_lng, district, state, pincode,
  role, reputation_score, is_verified, verified_at,
  is_active, created_at, last_login_at
`;

// Columns returned for a public profile (no PII, no location coords)
const PUBLIC_COLS = `
  id, name, bio, avatar_url, district, state,
  role, reputation_score, is_verified, created_at, last_login_at
`;

// ── Queries ──────────────────────────────────────────────────────────────────

export async function findByPhone(phone) {
  const { rows } = await pool.query(`SELECT ${PRIVATE_COLS} FROM users WHERE phone = $1`, [phone]);
  return rows.length ? toCamelCase(rows[0]) : null;
}

export async function findById(id) {
  const { rows } = await pool.query(`SELECT ${PRIVATE_COLS} FROM users WHERE id = $1`, [id]);
  return rows.length ? toCamelCase(rows[0]) : null;
}

export async function findByEmail(email) {
  const { rows } = await pool.query(`SELECT ${PRIVATE_COLS} FROM users WHERE email = $1`, [email]);
  return rows.length ? toCamelCase(rows[0]) : null;
}

export async function findByGoogleId(googleId) {
  const { rows } = await pool.query(`SELECT ${PRIVATE_COLS} FROM users WHERE google_id = $1`, [
    googleId,
  ]);
  return rows.length ? toCamelCase(rows[0]) : null;
}

export async function findPublicById(id) {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLS} FROM users WHERE id = $1 AND is_active = true`,
    [id],
  );
  return rows.length ? toCamelCase(rows[0]) : null;
}

export async function existsByPhone(phone) {
  const { rows } = await pool.query(`SELECT id FROM users WHERE phone = $1`, [phone]);
  return rows.length > 0;
}

export async function create({ phone, name }) {
  const { rows } = await pool.query(
    `INSERT INTO users (phone, name) VALUES ($1, $2)
     RETURNING id, phone, name, role`,
    [phone, name],
  );
  return toCamelCase(rows[0]);
}

export async function update(id, fields) {
  // fields are already validated/filtered snake_case columns
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');

  const { rows } = await pool.query(
    `UPDATE users
     SET ${setClauses}, updated_at = NOW()
     WHERE id = $1
     RETURNING id, phone, name, email, bio, avatar_url,
               district, state, pincode, role, reputation_score,
               is_verified`,
    [id, ...values],
  );
  return rows.length ? toCamelCase(rows[0]) : null;
}

export async function updateLastLogin(phone) {
  const { rows } = await pool.query(
    `UPDATE users
     SET last_login_at = NOW()
     WHERE phone = $1
     RETURNING ${PRIVATE_COLS}`,
    [phone],
  );
  return rows.length ? toCamelCase(rows[0]) : null;
}

/**
 * Fetch public stats for a user profile page.
 * Cached by the caller (Redis, 5 minutes).
 *
 * Returns { issuesRaised, issuesSupported, commentsPosted }
 */
export async function getPublicStats(userId) {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM issues   WHERE created_by = $1)                        AS issues_raised,
       (SELECT COUNT(*) FROM supports WHERE user_id    = $1)                        AS issues_supported,
       (SELECT COUNT(*) FROM comments WHERE user_id    = $1 AND is_deleted = false) AS comments_posted`,
    [userId],
  );
  const r = rows[0];
  return {
    issuesRaised: parseInt(r.issues_raised, 10),
    issuesSupported: parseInt(r.issues_supported, 10),
    commentsPosted: parseInt(r.comments_posted, 10),
  };
}

/**
 * Link a Google account to an existing user.
 * Sets google_id, email (if not already set), and email_verified.
 */
export async function linkGoogleAccount(userId, { googleId, email, emailVerified }) {
  const { rows } = await pool.query(
    `UPDATE users
     SET google_id      = $2,
         email          = COALESCE(email, $3),
         email_verified = CASE WHEN email IS NULL THEN $4 ELSE email_verified END,
         updated_at     = NOW()
     WHERE id = $1
     RETURNING ${PRIVATE_COLS}`,
    [userId, googleId, email, emailVerified],
  );
  return rows.length ? toCamelCase(rows[0]) : null;
}
