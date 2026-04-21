/**
 * Seed Script: CPGRAMS Taxonomy
 *
 * Seeds ministries → departments → grievance_categories in dependency order.
 * Idempotent: uses ON CONFLICT DO UPDATE so it's safe to run multiple times.
 *
 * Usage:  cd apps/api && npm run seed:taxonomy
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../src/db/postgres.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedsDir = path.join(__dirname, '..', 'seeds');

function readSeed(filename) {
  return JSON.parse(fs.readFileSync(path.join(seedsDir, filename), 'utf-8'));
}

async function seedMinistries(client) {
  const ministries = readSeed('ministries.json');
  console.info(`  → Seeding ${ministries.length} ministries...`);

  for (const m of ministries) {
    await client.query(
      `INSERT INTO ministries (code, name, type, state_code, website, cpgrams_code)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (code) DO UPDATE SET
         name         = EXCLUDED.name,
         type         = EXCLUDED.type,
         state_code   = EXCLUDED.state_code,
         website      = EXCLUDED.website,
         cpgrams_code = EXCLUDED.cpgrams_code`,
      [m.code, m.name, m.type, m.state_code || null, m.website || null, m.cpgrams_code || null],
    );
  }

  const { rows } = await client.query('SELECT COUNT(*) FROM ministries');
  console.info(`  ✓ Ministries: ${rows[0].count} rows`);
}

async function seedDepartments(client) {
  const departments = readSeed('departments.json');
  console.info(`  → Seeding ${departments.length} departments...`);

  for (const d of departments) {
    // Look up ministry_id by code
    const { rows: mRows } = await client.query('SELECT id FROM ministries WHERE code = $1', [
      d.ministry_code,
    ]);

    if (mRows.length === 0) {
      console.warn(
        `  ⚠ Ministry not found for code "${d.ministry_code}", skipping department "${d.code}"`,
      );
      continue;
    }

    const ministryId = mRows[0].id;

    await client.query(
      `INSERT INTO departments (ministry_id, code, name, nodal_officer_title, public_email, public_phone,
                                jurisdiction_type, jurisdiction_code, cpgrams_code, resolution_sla_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (ministry_id, code) DO UPDATE SET
         name               = EXCLUDED.name,
         nodal_officer_title = EXCLUDED.nodal_officer_title,
         public_email       = EXCLUDED.public_email,
         public_phone       = EXCLUDED.public_phone,
         jurisdiction_type  = EXCLUDED.jurisdiction_type,
         jurisdiction_code  = EXCLUDED.jurisdiction_code,
         cpgrams_code       = EXCLUDED.cpgrams_code,
         resolution_sla_days = EXCLUDED.resolution_sla_days`,
      [
        ministryId,
        d.code,
        d.name,
        d.nodal_officer_title || null,
        d.public_email || null,
        d.public_phone || null,
        d.jurisdiction_type || null,
        d.jurisdiction_code || null,
        d.cpgrams_code || null,
        d.resolution_sla_days || 21,
      ],
    );
  }

  const { rows } = await client.query('SELECT COUNT(*) FROM departments');
  console.info(`  ✓ Departments: ${rows[0].count} rows`);
}

async function seedGrievanceCategories(client) {
  const categories = readSeed('grievance-categories.json');
  console.info(`  → Seeding ${categories.length} grievance categories...`);

  for (const c of categories) {
    // Look up default_department_id by code (search across all ministries)
    let defaultDeptId = null;
    if (c.default_department_code) {
      const { rows: dRows } = await client.query(
        'SELECT id FROM departments WHERE code = $1 LIMIT 1',
        [c.default_department_code],
      );
      if (dRows.length > 0) {
        defaultDeptId = dRows[0].id;
      } else {
        // Not a hard error — some departments may not be seeded
        // e.g., MUNICIPAL_PWD is a template, not real
      }
    }

    // Convert keywords array to PostgreSQL TEXT[] literal
    const keywordsArray = c.keywords || [];

    await client.query(
      `INSERT INTO grievance_categories (name, slug, praja_category, cpgrams_category_code,
                                         default_department_id, keywords, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (slug) DO UPDATE SET
         name                  = EXCLUDED.name,
         praja_category        = EXCLUDED.praja_category,
         cpgrams_category_code = EXCLUDED.cpgrams_category_code,
         default_department_id = EXCLUDED.default_department_id,
         keywords              = EXCLUDED.keywords,
         description           = EXCLUDED.description`,
      [
        c.name,
        c.slug,
        c.praja_category,
        c.cpgrams_category_code || null,
        defaultDeptId,
        keywordsArray,
        c.description || null,
      ],
    );
  }

  const { rows } = await client.query('SELECT COUNT(*) FROM grievance_categories');
  console.info(`  ✓ Grievance Categories: ${rows[0].count} rows`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function seedTaxonomy() {
  console.info('\n╔═══════════════════════════════════════════════════╗');
  console.info('║   PrajaShakti — CPGRAMS Taxonomy Seed Script     ║');
  console.info('╚═══════════════════════════════════════════════════╝\n');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await seedMinistries(client);
    await seedDepartments(client);
    await seedGrievanceCategories(client);

    await client.query('COMMIT');

    console.info('\n✅ Taxonomy seeded successfully!\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Seed failed, transaction rolled back:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedTaxonomy();
