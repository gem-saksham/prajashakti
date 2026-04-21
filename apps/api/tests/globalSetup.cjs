/**
 * Jest globalSetup — runs once before all test suites.
 * Creates the prajashakti_test database and applies migrations.
 * Must be CJS because Jest's globalSetup runs in a separate process.
 */

const path       = require('path');
const { Client } = require('pg');
const { execSync } = require('child_process');

// Load .env from apps/api
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5433/prajashakti_test';

module.exports = async function globalSetup() {
  // ── 1. Create test database if it doesn't exist ───────────────────────────
  const adminUrl = TEST_DB_URL.replace(/\/[^/]+$/, '/postgres');
  const client   = new Client({ connectionString: adminUrl });
  await client.connect();

  try {
    // Drop and recreate to guarantee a clean schema every run.
    // Any active connections must be terminated first.
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM   pg_stat_activity
      WHERE  datname = 'prajashakti_test' AND pid <> pg_backend_pid()
    `);
    await client.query('DROP DATABASE IF EXISTS prajashakti_test');
    await client.query('CREATE DATABASE prajashakti_test');
    console.log('[test] Recreated database prajashakti_test');
  } finally {
    await client.end();
  }

  // ── 1b. Enable extensions in test DB ──────────────────────────────────────
  const testClient = new Client({ connectionString: TEST_DB_URL });
  await testClient.connect();
  try {
    await testClient.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await testClient.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    // PostGIS — only available when using postgis/postgis Docker image.
    // Silently skipped if the extension is not installed in this Postgres build.
    try {
      await testClient.query('CREATE EXTENSION IF NOT EXISTS "postgis"');
    } catch {
      // non-fatal: Haversine fallback is used when PostGIS is unavailable
    }
  } finally {
    await testClient.end();
  }

  // ── 2. Run migrations against the test database ───────────────────────────
  const apiDir     = path.join(__dirname, '..');
  const rootDir    = path.join(apiDir, '../..');
  // node-pg-migrate is hoisted to the monorepo root in npm workspaces
  const pgMigrate  = path.join(rootDir, 'node_modules/.bin/node-pg-migrate.cmd');
  const pgMigrateJs = path.join(rootDir, 'node_modules/node-pg-migrate/bin/node-pg-migrate.js');

  try {
    // Use the JS entry point directly — works cross-platform without shell scripts
    execSync(
      `node "${pgMigrateJs}" up --migrations-dir migrations --migration-file-extension cjs`,
      {
        cwd: apiDir,
        env: { ...process.env, DATABASE_URL: TEST_DB_URL },
        stdio: 'pipe',
      },
    );
    console.log('[test] Migrations applied to prajashakti_test');
  } catch (err) {
    const out = (err.stdout?.toString() ?? '') + (err.stderr?.toString() ?? '');
    console.error('[test] Migration error:', out || err.message);
    throw err;
  }

  // ── 3. Seed taxonomy (ministries, departments, grievance_categories) ─────────
  // These are foundational read-only data needed by tag suggestion tests.
  // They are seeded once and never truncated between tests.
  try {
    execSync(
      `node scripts/seed-taxonomy.js`,
      {
        cwd: apiDir,
        env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: TEST_DB_URL },
        stdio: 'pipe',
      },
    );
    console.log('[test] Taxonomy seeded to prajashakti_test');
  } catch (err) {
    const out = (err.stdout?.toString() ?? '') + (err.stderr?.toString() ?? '');
    console.error('[test] Taxonomy seed error:', out || err.message);
    // Non-fatal: tag suggestion tests degrade gracefully when taxonomy is absent
  }

  // Expose TEST_DATABASE_URL so test files can use it
  process.env.TEST_DATABASE_URL = TEST_DB_URL;
};
