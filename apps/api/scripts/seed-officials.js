#!/usr/bin/env node
/**
 * Seed script: public officials from seeds/officials.json.
 *
 * All data sourced from publicly available government websites.
 * No personal contact information — public email/phone only.
 *
 * Idempotent — uses ON CONFLICT DO NOTHING to avoid duplicates.
 *
 * Usage:
 *   npm run seed:officials   (from apps/api/)
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
    const dataPath = path.join(__dirname, '../seeds/officials.json');
    const raw = readFileSync(dataPath, 'utf8');
    const officials = JSON.parse(raw);

    console.log(`[seed:officials] Seeding ${officials.length} officials...`);

    await client.query('BEGIN');

    let inserted = 0;
    let skipped = 0;

    for (const off of officials) {
      // Resolve department_id from department_code if provided
      let departmentId = null;
      let ministryId = null;

      if (off.department_code) {
        const { rows } = await client.query(
          `SELECT id FROM departments WHERE code = $1 AND is_active = true LIMIT 1`,
          [off.department_code],
        );
        departmentId = rows[0]?.id || null;
        if (!departmentId) {
          console.warn(
            `  [warn] Department code "${off.department_code}" not found for "${off.name}" — skipping FK`,
          );
        }
      }

      if (off.ministry_code) {
        const { rows } = await client.query(
          `SELECT id FROM ministries WHERE code = $1 AND is_active = true LIMIT 1`,
          [off.ministry_code],
        );
        ministryId = rows[0]?.id || null;
      }

      // Use name + designation + state_code as idempotency key
      const { rows } = await client.query(
        `INSERT INTO officials (
           name, designation, department_id, ministry_id,
           jurisdiction_type, jurisdiction_code, state_code, district_code,
           public_email, public_phone, office_address, twitter_handle,
           cadre, source, is_verified
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          off.name,
          off.designation,
          departmentId,
          ministryId,
          off.jurisdiction_type || null,
          off.jurisdiction_code || null,
          off.state_code || null,
          off.district_code || null,
          off.public_email || null,
          off.public_phone || null,
          off.office_address || null,
          off.twitter_handle || null,
          off.cadre || null,
          off.source || 'manual',
          false, // is_verified — manual review required
        ],
      );

      if (rows.length > 0) {
        inserted++;
      } else {
        skipped++;
      }
    }

    await client.query('COMMIT');

    console.log(`[seed:officials] Done.`);
    console.log(`  Inserted : ${inserted}`);
    console.log(`  Skipped  : ${skipped} (already exist)`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed:officials] Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
