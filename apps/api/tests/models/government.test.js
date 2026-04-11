/**
 * Integration tests — Government Model (CPGRAMS Taxonomy)
 *
 * Tests the DB query layer for the government taxonomy tables:
 *   - listMinistries (with type filter)
 *   - getMinistryById
 *   - searchMinistries
 *   - getMinistryByStateCode
 *   - listDepartments (by ministry)
 *   - getDepartmentById (with ministry join)
 *   - searchDepartments
 *   - listDepartmentsByJurisdiction
 *   - listGrievanceCategories (with praja_category filter)
 *   - findCategoryByKeywords (NLP fallback)
 *   - getCategoryBySlug
 *
 * Prerequisites: taxonomy seed data must be in the test database.
 *   The globalSetup.cjs runs migrations; the test seeds the taxonomy before testing.
 */

import { createTestApp, closeTestConnections, testPool } from '../helpers.js';

import * as GovModel from '../../src/models/government.js';

let app;

beforeAll(async () => {
  app = await createTestApp();

  // Seed taxonomy data if not already present
  const { rows } = await testPool.query('SELECT COUNT(*) FROM ministries');
  if (parseInt(rows[0].count, 10) === 0) {
    // Run the taxonomy seed script logic inline
    const { default: fs } = await import('fs');
    const { default: path } = await import('path');
    const { fileURLToPath } = await import('url');
    const { readFileSync } = fs;

    const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

    const ministries = JSON.parse(readFileSync(path.join(apiDir, 'seeds/ministries.json'), 'utf8'));
    const departments = JSON.parse(
      readFileSync(path.join(apiDir, 'seeds/departments.json'), 'utf8'),
    );
    const categories = JSON.parse(
      readFileSync(path.join(apiDir, 'seeds/grievance-categories.json'), 'utf8'),
    );

    // Insert ministries
    for (const m of ministries) {
      await testPool.query(
        `INSERT INTO ministries (code, name, type, state_code, website, cpgrams_code)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO NOTHING`,
        [m.code, m.name, m.type, m.state_code || null, m.website || null, m.cpgrams_code || null],
      );
    }

    // Build ministry code→id map
    const { rows: mRows } = await testPool.query('SELECT id, code FROM ministries');
    const ministryMap = Object.fromEntries(mRows.map((r) => [r.code, r.id]));

    // Insert departments
    for (const d of departments) {
      const ministryId = ministryMap[d.ministry_code] || null;
      // Skip departments whose ministry wasn't found — ministry_id NOT NULL constraint
      if (!ministryId) continue;
      await testPool.query(
        `INSERT INTO departments (code, name, ministry_id, nodal_officer_title, public_email, public_phone,
         jurisdiction_type, jurisdiction_code, cpgrams_code, resolution_sla_days, parent_department_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (ministry_id, code) DO NOTHING`,
        [
          d.code,
          d.name,
          ministryId,
          d.nodal_officer_title || null,
          d.public_email || null,
          d.public_phone || null,
          d.jurisdiction_type || null,
          d.jurisdiction_code || null,
          d.cpgrams_code || null,
          d.resolution_sla_days || null,
          null, // parent_department_id — resolve later if needed
        ],
      );
    }

    // Build department code→id map
    const { rows: dRows } = await testPool.query('SELECT id, code FROM departments');
    const deptMap = Object.fromEntries(dRows.map((r) => [r.code, r.id]));

    // Insert grievance categories
    for (const c of categories) {
      const defaultDeptId = c.default_department_code
        ? deptMap[c.default_department_code] || null
        : null;
      await testPool.query(
        `INSERT INTO grievance_categories (name, slug, praja_category, cpgrams_category_code,
         description, keywords, default_department_id, parent_category_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (slug) DO NOTHING`,
        [
          c.name,
          c.slug,
          c.praja_category,
          c.cpgrams_category_code || null,
          c.description || null,
          c.keywords || [],
          defaultDeptId,
          null, // parent_category_id — resolve later if needed
        ],
      );
    }
  }
});

afterAll(async () => {
  await app.close();
  await closeTestConnections();
});

// ── Ministries ───────────────────────────────────────────────────────────────

describe('GovModel.listMinistries', () => {
  test('returns all active ministries', async () => {
    const ministries = await GovModel.listMinistries();
    expect(ministries.length).toBeGreaterThanOrEqual(10);
    // Every row should have camelCase keys
    expect(ministries[0]).toHaveProperty('id');
    expect(ministries[0]).toHaveProperty('code');
    expect(ministries[0]).toHaveProperty('name');
    expect(ministries[0]).toHaveProperty('type');
  });

  test('filters by type=central', async () => {
    const ministries = await GovModel.listMinistries({ type: 'central' });
    expect(ministries.length).toBeGreaterThan(0);
    expect(ministries.every((m) => m.type === 'central')).toBe(true);
  });

  test('filters by type=state', async () => {
    const ministries = await GovModel.listMinistries({ type: 'state' });
    expect(ministries.length).toBeGreaterThan(0);
    expect(ministries.every((m) => m.type === 'state')).toBe(true);
  });

  test('filters by type=ut', async () => {
    const ministries = await GovModel.listMinistries({ type: 'ut' });
    // May or may not have UTs depending on seed
    expect(Array.isArray(ministries)).toBe(true);
    if (ministries.length > 0) {
      expect(ministries.every((m) => m.type === 'ut')).toBe(true);
    }
  });
});

describe('GovModel.getMinistryById', () => {
  test('returns a specific ministry by ID', async () => {
    const all = await GovModel.listMinistries({ type: 'central' });
    const first = all[0];
    const ministry = await GovModel.getMinistryById(first.id);

    expect(ministry).not.toBeNull();
    expect(ministry.id).toBe(first.id);
    expect(ministry.name).toBe(first.name);
  });

  test('returns null for non-existent ID', async () => {
    const ministry = await GovModel.getMinistryById('00000000-0000-0000-0000-000000000000');
    expect(ministry).toBeNull();
  });
});

describe('GovModel.searchMinistries', () => {
  test('search returns results matching query', async () => {
    const results = await GovModel.searchMinistries('Health');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((m) => m.name.toLowerCase().includes('health'))).toBe(true);
  });

  test('search with no matches returns empty', async () => {
    const results = await GovModel.searchMinistries('zzznonexistent');
    expect(results).toHaveLength(0);
  });
});

describe('GovModel.getMinistryByStateCode', () => {
  test('returns ministry for a valid state code', async () => {
    // Get a state code from the data
    const states = await GovModel.listMinistries({ type: 'state' });
    if (states.length > 0) {
      const stateCode = states[0].stateCode;
      if (stateCode) {
        const ministry = await GovModel.getMinistryByStateCode(stateCode);
        expect(ministry).not.toBeNull();
        expect(ministry.stateCode).toBe(stateCode);
      }
    }
  });

  test('returns null for non-existent state code', async () => {
    const ministry = await GovModel.getMinistryByStateCode('ZZ');
    expect(ministry).toBeNull();
  });
});

// ── Departments ──────────────────────────────────────────────────────────────

describe('GovModel.listDepartments', () => {
  test('returns departments for a given ministry', async () => {
    const ministries = await GovModel.listMinistries({ type: 'central' });
    // Find a ministry that has departments
    let departmentsFound = false;
    for (const m of ministries) {
      const departments = await GovModel.listDepartments(m.id);
      if (departments.length > 0) {
        departmentsFound = true;
        expect(departments[0]).toHaveProperty('id');
        expect(departments[0]).toHaveProperty('code');
        expect(departments[0]).toHaveProperty('name');
        break;
      }
    }
    // There should be at least one ministry with departments
    expect(departmentsFound).toBe(true);
  });
});

describe('GovModel.getDepartmentById', () => {
  test('returns department with nested ministry info', async () => {
    const { rows } = await testPool.query('SELECT id FROM departments LIMIT 1');
    if (rows.length > 0) {
      const dept = await GovModel.getDepartmentById(rows[0].id);
      expect(dept).not.toBeNull();
      expect(dept).toHaveProperty('id');
      expect(dept).toHaveProperty('ministry');
      expect(dept.ministry).toHaveProperty('id');
      expect(dept.ministry).toHaveProperty('name');
    }
  });

  test('returns null for non-existent ID', async () => {
    const dept = await GovModel.getDepartmentById('00000000-0000-0000-0000-000000000000');
    expect(dept).toBeNull();
  });
});

describe('GovModel.searchDepartments', () => {
  test('search returns results with nested ministry', async () => {
    const results = await GovModel.searchDepartments('Education');
    if (results.length > 0) {
      expect(results[0]).toHaveProperty('ministry');
      expect(results[0].ministry).toHaveProperty('name');
    }
  });
});

describe('GovModel.listDepartmentsByJurisdiction', () => {
  test('returns departments by jurisdiction type and code', async () => {
    // Get a department with known jurisdiction
    const { rows } = await testPool.query(
      `SELECT jurisdiction_type, jurisdiction_code
       FROM departments
       WHERE jurisdiction_type IS NOT NULL AND jurisdiction_code IS NOT NULL
       LIMIT 1`,
    );

    if (rows.length > 0) {
      const { jurisdiction_type: jType, jurisdiction_code: jCode } = rows[0];
      const depts = await GovModel.listDepartmentsByJurisdiction(jType, jCode);
      expect(depts.length).toBeGreaterThan(0);
      expect(depts[0]).toHaveProperty('ministry');
    }
  });
});

// ── Grievance Categories ─────────────────────────────────────────────────────

describe('GovModel.listGrievanceCategories', () => {
  test('returns all active categories', async () => {
    const categories = await GovModel.listGrievanceCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0]).toHaveProperty('id');
    expect(categories[0]).toHaveProperty('name');
    expect(categories[0]).toHaveProperty('slug');
    expect(categories[0]).toHaveProperty('prajaCategory');
    expect(categories[0]).toHaveProperty('defaultDepartment'); // null or object
  });

  test('filters by PrajaShakti category', async () => {
    const categories = await GovModel.listGrievanceCategories('Infrastructure');
    if (categories.length > 0) {
      expect(categories.every((c) => c.prajaCategory === 'Infrastructure')).toBe(true);
    }
  });
});

describe('GovModel.findCategoryByKeywords', () => {
  test('matches keywords in text and returns ranked results', async () => {
    const results = await GovModel.findCategoryByKeywords('road pothole water supply');
    expect(results.length).toBeGreaterThan(0);

    // Should have matchCount
    expect(results[0]).toHaveProperty('matchCount');
    expect(results[0].matchCount).toBeGreaterThan(0);

    // Results should be ordered by matchCount DESC
    if (results.length >= 2) {
      expect(results[0].matchCount).toBeGreaterThanOrEqual(results[1].matchCount);
    }
  });

  test('returns empty array for unmatched text', async () => {
    const results = await GovModel.findCategoryByKeywords('xylophone zephyr quintessential');
    expect(results).toHaveLength(0);
  });
});

describe('GovModel.getCategoryBySlug', () => {
  test('returns category with department info by slug', async () => {
    const all = await GovModel.listGrievanceCategories();
    if (all.length > 0) {
      const slug = all[0].slug;
      const category = await GovModel.getCategoryBySlug(slug);

      expect(category).not.toBeNull();
      expect(category.slug).toBe(slug);
      expect(category).toHaveProperty('defaultDepartment');
    }
  });

  test('returns null for non-existent slug', async () => {
    const category = await GovModel.getCategoryBySlug('nonexistent-slug-that-does-not-exist');
    expect(category).toBeNull();
  });
});
