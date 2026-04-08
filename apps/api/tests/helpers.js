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

export async function truncateTables() {
  await pool.query(`
    TRUNCATE user_activity, notifications, comments, supports, issues, officials, users
    RESTART IDENTITY CASCADE
  `);
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

// ── Auth header ───────────────────────────────────────────────────────────────

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}
