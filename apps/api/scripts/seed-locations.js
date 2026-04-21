#!/usr/bin/env node
/**
 * Seed script: states and districts from seeds/states-districts.json.
 *
 * Idempotent — uses ON CONFLICT DO UPDATE so it can be re-run safely.
 * Source data: LGD (Local Government Directory) public domain data.
 *
 * Usage:
 *   npm run seed:locations   (from apps/api/)
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/prajashakti',
});

async function seed() {
  const client = await pool.connect();

  try {
    const dataPath = path.join(__dirname, '../seeds/states-districts.json');
    const raw = readFileSync(dataPath, 'utf8');
    const statesData = JSON.parse(raw);

    console.log(`[seed:locations] Seeding ${statesData.length} states/UTs...`);

    await client.query('BEGIN');

    let stateCount = 0;
    let districtCount = 0;

    for (const state of statesData) {
      // Upsert state
      const { rows: stateRows } = await client.query(
        `INSERT INTO states (code, name, type, lgd_code)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE
           SET name     = EXCLUDED.name,
               type     = EXCLUDED.type,
               lgd_code = COALESCE(EXCLUDED.lgd_code, states.lgd_code)
         RETURNING id`,
        [state.code, state.name, state.type, state.lgd_code || null],
      );

      const stateId = stateRows[0].id;
      stateCount++;

      // Upsert each district
      if (Array.isArray(state.districts)) {
        for (const district of state.districts) {
          await client.query(
            `INSERT INTO districts (code, name, state_id, lgd_code)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (state_id, code) DO UPDATE
               SET name     = EXCLUDED.name,
                   lgd_code = COALESCE(EXCLUDED.lgd_code, districts.lgd_code)`,
            [district.code, district.name, stateId, district.lgd_code || null],
          );
          districtCount++;
        }
      }
    }

    await client.query('COMMIT');

    console.log(`[seed:locations] Done.`);
    console.log(`  States/UTs seeded : ${stateCount}`);
    console.log(`  Districts seeded  : ${districtCount}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed:locations] Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
