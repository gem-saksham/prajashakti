import pg from 'pg';

const { Pool } = pg;

// ─── Connection Pool ──────────────────────────────────────────────────────────
// In test mode, auto-select the isolated test database so models work correctly
// when imported directly by unit tests (without fastify.db injection).
const connectionString =
  process.env.NODE_ENV === 'test'
    ? process.env.TEST_DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5433/prajashakti_test'
    : process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  max: process.env.NODE_ENV === 'test' ? 5 : 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[postgres] unexpected pool error', err);
});

// ─── Query Helper ─────────────────────────────────────────────────────────────
// Logs slow queries (>500 ms) in non-production environments so we can spot
// missing indexes early without needing a full APM stack.
export async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  if (process.env.NODE_ENV !== 'production' && duration > 500) {
    console.warn(`[postgres] slow query (${duration}ms)`, {
      text,
      duration,
      rows: result.rowCount,
    });
  }

  return result;
}

// ─── Health Check ─────────────────────────────────────────────────────────────
export async function checkHealth() {
  const result = await pool.query('SELECT 1');
  return result.rowCount === 1;
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
export async function closePool() {
  await pool.end();
}

export default pool;
