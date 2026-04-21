/**
 * Test helpers — shared across all test suites.
 *
 * postgres.js + redis.js auto-select test resources when NODE_ENV=test,
 * so we import them directly rather than creating separate test pools.
 *
 * createTestApp()        — Fastify instance using test DB + Redis db:1
 * truncateTables()       — wipe all rows (fast schema-preserving cleanup)
 * closeTestConnections() — call in afterAll to prevent open-handle warnings
 * createTestUser()       — inserts a user row and returns user + signed JWT
 * createTestIssue()      — inserts an issue row with sensible defaults
 * authHeader()           — returns { Authorization: 'Bearer <token>' }
 */

import pool from '../src/db/postgres.js';
import redis from '../src/db/redis.js';
import { buildApp } from '../src/app.js';
import { toCamelCase } from '../src/utils/transform.js';

// Ensure test mode is set before any DB connections are opened
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

// Re-export so test files can use pool/redis directly (e.g. for direct DB assertions)
export { pool as testPool, redis as testRedis };

// ── App factory ───────────────────────────────────────────────────────────────

export async function createTestApp() {
  // postgres.js and redis.js already point to test resources (NODE_ENV=test)
  const app = await buildApp({ db: pool, redis });
  await app.ready();
  return app;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

/**
 * Truncate transactional tables. Taxonomy tables (ministries, departments,
 * grievance_categories) are NOT truncated — they are seed data.
 *
 * Tables listed from outermost FK dependents → innermost parents.
 * Supports + comments reference issues; user_activity/notifications reference users.
 * The officials table may not exist in Sprint 2 schema — catch and ignore.
 */
export async function truncateTables() {
  await pool.query(`
    TRUNCATE user_activity, notifications, comments, supports, issue_officials, issues, users
    RESTART IDENTITY CASCADE
  `);
  // officials seeded per-test-file — do NOT truncate here
  await redis.flushdb();
}

export async function closeTestConnections() {
  await pool.end();
  redis.disconnect();
}

// ── User factory ──────────────────────────────────────────────────────────────

let _phoneCounter = 9000000001;

/**
 * Insert a user directly into the test DB and return a signed JWT for them.
 */
export async function createTestUser(app, overrides = {}) {
  const phone = overrides.phone ?? String(_phoneCounter++);

  const { rows } = await pool.query(
    `INSERT INTO users (phone, name, role, district, state, is_verified)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, phone, name, email, role, district, state,
               reputation_score, is_verified, is_active, created_at`,
    [
      phone,
      overrides.name ?? 'Test User',
      overrides.role ?? 'citizen',
      overrides.district ?? 'Test District',
      overrides.state ?? 'Test State',
      overrides.is_verified ?? false,
    ],
  );

  const user = toCamelCase(rows[0]);
  const token = app.jwt.sign({ id: user.id, phone: user.phone, role: user.role });

  return { user, token };
}

// ── Issue factory ─────────────────────────────────────────────────────────────

/**
 * Insert an issue directly into the test DB with sensible defaults.
 * Returns the raw camelCase issue row (no joins).
 */
export async function createTestIssue(userId, overrides = {}) {
  const { rows } = await pool.query(
    `INSERT INTO issues (
       title, description, category, urgency,
       location_lat, location_lng, district, state, pincode,
       created_by, is_anonymous
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      overrides.title ?? 'Broken road near main market with potholes',
      overrides.description ??
        'Large potholes on the main road causing accidents and vehicle damage daily',
      overrides.category ?? 'Infrastructure',
      overrides.urgency ?? 'medium',
      overrides.locationLat ?? 28.6139,
      overrides.locationLng ?? 77.209,
      overrides.district ?? 'Central Delhi',
      overrides.state ?? 'Delhi',
      overrides.pincode ?? '110001',
      userId,
      overrides.isAnonymous ?? false,
    ],
  );

  return toCamelCase(rows[0]);
}

// ── Auth header ───────────────────────────────────────────────────────────────

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}
