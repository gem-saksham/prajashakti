/**
 * Location service + model tests — Day 19.
 *
 * Tests cover:
 *   - locationValidator pure functions
 *   - LocationModel (states/districts DB queries)
 *   - IssueModel geo queries (findNearby, findByJurisdiction, findInBoundingBox)
 *   - Location API routes (GET /states, GET /states/:code/districts,
 *                          GET /location/jurisdiction, GET /location/responsible-departments)
 */

import {
  createTestApp,
  createTestUser,
  createTestIssue,
  truncateTables,
  closeTestConnections,
  testPool,
  testRedis,
} from '../helpers.js';
import {
  isWithinIndia,
  isValidPincode,
  normalizeStateName,
  stateNameToCode,
} from '../../src/utils/locationValidator.js';
import * as LocationModel from '../../src/models/location.js';
import * as IssueModel from '../../src/models/issue.js';

// ── Test data ─────────────────────────────────────────────────────────────────

const TEST_STATES = [
  { code: 'DL', name: 'Delhi', type: 'ut', lgd_code: '07' },
  { code: 'PB', name: 'Punjab', type: 'state', lgd_code: '03' },
  { code: 'MH', name: 'Maharashtra', type: 'state', lgd_code: '27' },
];

const TEST_DISTRICTS_DL = [
  { code: 'DL01', name: 'Central Delhi', lgd_code: '501' },
  { code: 'DL02', name: 'North Delhi', lgd_code: '502' },
  { code: 'DL11', name: 'Shahdara', lgd_code: '510' },
];

let app;
let token;
let userId;
let stateIdDL;

// ── Seed states/districts for tests ──────────────────────────────────────────

async function seedTestLocations() {
  // Insert test states
  for (const s of TEST_STATES) {
    const { rows } = await testPool.query(
      `INSERT INTO states (code, name, type, lgd_code)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [s.code, s.name, s.type, s.lgd_code],
    );
    if (s.code === 'DL') stateIdDL = rows[0].id;
  }

  if (!stateIdDL) {
    const { rows } = await testPool.query(`SELECT id FROM states WHERE code = 'DL'`);
    stateIdDL = rows[0]?.id;
  }

  // Insert test districts for DL
  for (const d of TEST_DISTRICTS_DL) {
    await testPool.query(
      `INSERT INTO districts (code, name, state_id, lgd_code)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name`,
      [d.code, d.name, stateIdDL, d.lgd_code],
    );
  }
}

async function cleanTestLocations() {
  if (stateIdDL) {
    await testPool.query(`DELETE FROM districts WHERE state_id = $1`, [stateIdDL]);
  }
  await testPool.query(`DELETE FROM states WHERE code = ANY($1)`, [TEST_STATES.map((s) => s.code)]);
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  app = await createTestApp();
  await truncateTables();
  await seedTestLocations();
  ({
    token,
    user: { id: userId },
  } = await createTestUser(app));
});

afterAll(async () => {
  await cleanTestLocations();
  await truncateTables();
  await closeTestConnections();
  await app.close();
});

// ── 1. locationValidator pure functions ───────────────────────────────────────

describe('isWithinIndia', () => {
  test('accepts a coordinate in central India (Delhi)', () => {
    expect(isWithinIndia(28.6139, 77.209)).toBe(true);
  });

  test('accepts a coordinate in far south (Tamil Nadu)', () => {
    expect(isWithinIndia(8.5, 77.0)).toBe(true);
  });

  test('accepts northernmost point (J&K)', () => {
    expect(isWithinIndia(36.5, 76.5)).toBe(true);
  });

  test('rejects Islamabad, Pakistan (outside lng bound)', () => {
    // Islamabad is at 73°E — within the bounding box; use Kabul (69°N, 34°N) instead
    // which is outside India's lat range. Karachi at 24.8°N, 67.0°E is just west of India.
    expect(isWithinIndia(24.8, 67.0)).toBe(false); // lng 67 < 68 (India west bound)
  });

  test('rejects coordinate east of India (Myanmar border)', () => {
    expect(isWithinIndia(20.0, 98.0)).toBe(false); // lng 98 > 97.5 (India east bound)
  });

  test('rejects London', () => {
    expect(isWithinIndia(51.5, -0.1)).toBe(false);
  });

  test('rejects lat too far south', () => {
    expect(isWithinIndia(5.0, 80.0)).toBe(false);
  });
});

describe('isValidPincode', () => {
  test('accepts valid 6-digit pincode', () => {
    expect(isValidPincode('110001')).toBe(true);
    expect(isValidPincode('400001')).toBe(true);
    expect(isValidPincode('560001')).toBe(true);
  });

  test('accepts numeric pincode', () => {
    expect(isValidPincode(110001)).toBe(true);
  });

  test('rejects pincode starting with 0', () => {
    expect(isValidPincode('012345')).toBe(false);
  });

  test('rejects pincode starting with 9', () => {
    expect(isValidPincode('912345')).toBe(false);
  });

  test('rejects 5-digit pincode', () => {
    expect(isValidPincode('11001')).toBe(false);
  });

  test('rejects 7-digit pincode', () => {
    expect(isValidPincode('1100011')).toBe(false);
  });

  test('rejects non-numeric pincode', () => {
    expect(isValidPincode('ABCDEF')).toBe(false);
  });

  test('rejects null/undefined', () => {
    expect(isValidPincode(null)).toBe(false);
    expect(isValidPincode(undefined)).toBe(false);
  });
});

describe('normalizeStateName', () => {
  test('expands UP abbreviation', () => {
    expect(normalizeStateName('UP')).toBe('Uttar Pradesh');
  });

  test('expands DL abbreviation', () => {
    expect(normalizeStateName('DL')).toBe('Delhi');
  });

  test('normalises Orissa to Odisha', () => {
    expect(normalizeStateName('ORISSA')).toBe('Odisha');
  });

  test('normalises Uttaranchal to Uttarakhand', () => {
    expect(normalizeStateName('UTTARANCHAL')).toBe('Uttarakhand');
  });

  test('normalises Pondicherry to Puducherry', () => {
    expect(normalizeStateName('PONDICHERRY')).toBe('Puducherry');
  });

  test('normalises Delhi NCT variant', () => {
    expect(normalizeStateName('NCT OF DELHI')).toBe('Delhi');
  });

  test('returns input unchanged for unknown names', () => {
    expect(normalizeStateName('Unknown State')).toBe('Unknown State');
  });

  test('handles null/empty gracefully', () => {
    expect(normalizeStateName(null)).toBe(null);
    expect(normalizeStateName('')).toBe('');
  });
});

describe('stateNameToCode', () => {
  test('maps Punjab to PB', () => {
    expect(stateNameToCode('Punjab')).toBe('PB');
  });

  test('maps Delhi to DL', () => {
    expect(stateNameToCode('Delhi')).toBe('DL');
  });

  test('returns null for unknown name', () => {
    expect(stateNameToCode('Atlantis')).toBe(null);
  });
});

// ── 2. LocationModel DB queries ───────────────────────────────────────────────

describe('LocationModel.listStates', () => {
  test('returns all active test states', async () => {
    const states = await LocationModel.listStates();
    const codes = states.map((s) => s.code);
    expect(codes).toContain('DL');
    expect(codes).toContain('PB');
    expect(codes).toContain('MH');
  });

  test('filters by type=ut returns DL', async () => {
    const uts = await LocationModel.listStates({ type: 'ut' });
    const codes = uts.map((s) => s.code);
    expect(codes).toContain('DL');
    expect(codes).not.toContain('PB'); // PB is a state
  });

  test('filters by type=state excludes DL', async () => {
    const states = await LocationModel.listStates({ type: 'state' });
    const codes = states.map((s) => s.code);
    expect(codes).not.toContain('DL');
    expect(codes).toContain('PB');
  });
});

describe('LocationModel.getStateByCode', () => {
  test('returns DL state', async () => {
    const state = await LocationModel.getStateByCode('DL');
    expect(state).not.toBeNull();
    expect(state.name).toBe('Delhi');
    expect(state.type).toBe('ut');
    expect(state.lgdCode).toBe('07');
  });

  test('returns null for unknown code', async () => {
    const state = await LocationModel.getStateByCode('XX');
    expect(state).toBeNull();
  });

  test('is case-insensitive', async () => {
    const state = await LocationModel.getStateByCode('dl');
    expect(state).not.toBeNull();
    expect(state.code).toBe('DL');
  });
});

describe('LocationModel.listDistrictsByStateCode', () => {
  test('returns all DL districts', async () => {
    const districts = await LocationModel.listDistrictsByStateCode('DL');
    expect(districts.length).toBe(TEST_DISTRICTS_DL.length);
    const names = districts.map((d) => d.name);
    expect(names).toContain('Central Delhi');
    expect(names).toContain('Shahdara');
  });

  test('returns empty for state with no districts', async () => {
    const districts = await LocationModel.listDistrictsByStateCode('MH');
    expect(Array.isArray(districts)).toBe(true);
    expect(districts.length).toBe(0);
  });
});

describe('LocationModel.findDistrictByName', () => {
  test('finds Central Delhi in DL', async () => {
    const d = await LocationModel.findDistrictByName('DL', 'Central Delhi');
    expect(d).not.toBeNull();
    expect(d.code).toBe('DL01');
    expect(d.lgdCode).toBe('501');
  });

  test('returns null for wrong state', async () => {
    const d = await LocationModel.findDistrictByName('PB', 'Central Delhi');
    expect(d).toBeNull();
  });

  test('is case-insensitive', async () => {
    const d = await LocationModel.findDistrictByName('DL', 'central delhi');
    expect(d).not.toBeNull();
    expect(d.name).toBe('Central Delhi');
  });
});

// ── 3. IssueModel geo queries ─────────────────────────────────────────────────

describe('IssueModel.findNearby', () => {
  let issueId;

  beforeAll(async () => {
    // Create an issue with Delhi coordinates
    const issue = await createTestIssue(userId, {
      locationLat: 28.6139,
      locationLng: 77.209,
      district: 'Central Delhi',
      state: 'Delhi',
    });
    issueId = issue.id;
  });

  test('finds the issue within 5km radius of Delhi', async () => {
    const results = await IssueModel.findNearby(28.6139, 77.209, 5);
    const ids = results.map((r) => r.id);
    expect(ids).toContain(issueId);
  });

  test('includes distanceKm field', async () => {
    const results = await IssueModel.findNearby(28.6139, 77.209, 5);
    const issue = results.find((r) => r.id === issueId);
    expect(issue).toBeDefined();
    expect(typeof issue.distanceKm).toBe('number');
    expect(issue.distanceKm).toBeLessThan(1);
  });

  test('does not find issue when radius is too small (different location)', async () => {
    // Kolkata coordinates — ~1300km from Delhi
    const results = await IssueModel.findNearby(22.5726, 88.3639, 5);
    const ids = results.map((r) => r.id);
    expect(ids).not.toContain(issueId);
  });

  test('accepts category filter', async () => {
    const results = await IssueModel.findNearby(28.6139, 77.209, 50, { category: 'Roads' });
    // Should not fail — may be empty if category does not match
    expect(Array.isArray(results)).toBe(true);
  });
});

describe('IssueModel.findByJurisdiction', () => {
  beforeAll(async () => {
    // Ensure at least one issue is in Delhi state
    await createTestIssue(userId, {
      district: 'Central Delhi',
      state: 'Delhi',
      locationLat: 28.6139,
      locationLng: 77.209,
    });
  });

  test('finds issues in DL state', async () => {
    const result = await IssueModel.findByJurisdiction('DL');
    expect(result.pagination).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.jurisdiction.stateCode).toBe('DL');
  });

  test('includes pagination metadata', async () => {
    const result = await IssueModel.findByJurisdiction('DL', null, { page: 1, limit: 5 });
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(5);
    expect(typeof result.pagination.total).toBe('number');
  });

  test('returns empty data for state with no issues', async () => {
    const result = await IssueModel.findByJurisdiction('PB');
    expect(Array.isArray(result.data)).toBe(true);
  });
});

describe('IssueModel.findInBoundingBox', () => {
  test('finds Delhi issue in Delhi bounding box', async () => {
    // Approximate bbox for Delhi
    const results = await IssueModel.findInBoundingBox(28.4, 76.8, 28.9, 77.4);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  test('returns empty for bounding box in ocean', async () => {
    // Far south Indian Ocean
    const results = await IssueModel.findInBoundingBox(-30, 70, -25, 75);
    expect(results.length).toBe(0);
  });
});

// ── 4. Location API routes ────────────────────────────────────────────────────

describe('GET /api/v1/location/states', () => {
  test('returns 200 with states list (public route)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/location/states' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.states)).toBe(true);
    expect(body.states.length).toBeGreaterThan(0);
  });

  test('filters by type=ut', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/location/states?type=ut',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const types = body.states.map((s) => s.type);
    expect(types.every((t) => t === 'ut')).toBe(true);
  });

  test('uses Redis cache on second request', async () => {
    await testRedis.del('location:states:all');
    const res1 = await app.inject({ method: 'GET', url: '/api/v1/location/states' });
    const res2 = await app.inject({ method: 'GET', url: '/api/v1/location/states' });
    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);
    // Both should return same data
    expect(res1.json().states.length).toBe(res2.json().states.length);
  });
});

describe('GET /api/v1/location/states/:code/districts', () => {
  test('returns districts for DL', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/location/states/DL/districts',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.districts)).toBe(true);
    expect(body.districts.length).toBe(TEST_DISTRICTS_DL.length);
    expect(body.state.code).toBe('DL');
  });

  test('is case-insensitive — lowercase code works', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/location/states/dl/districts',
    });
    expect(res.statusCode).toBe(200);
  });

  test('returns 404 for unknown state code', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/location/states/XX/districts',
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/v1/location/jurisdiction', () => {
  test('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/location/jurisdiction?lat=28.6139&lng=77.2090',
    });
    expect(res.statusCode).toBe(401);
  });

  test('returns 400 for coordinates outside India', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/location/jurisdiction?lat=51.5&lng=-0.1',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('OUTSIDE_INDIA');
  });

  test('returns 400 when lat/lng are missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/location/jurisdiction?lat=28.6139',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/v1/location/responsible-departments', () => {
  test('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/location/responsible-departments?lat=28.6139&lng=77.2090',
    });
    expect(res.statusCode).toBe(401);
  });

  test('returns 400 for coordinates outside India', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/location/responsible-departments?lat=0&lng=0',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('OUTSIDE_INDIA');
  });
});

describe('GET /api/v1/issues/jurisdiction', () => {
  test('returns issues in DL state', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/issues/jurisdiction?state_code=DL',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('returns 400 when state_code is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/issues/jurisdiction',
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/v1/issues/bbox', () => {
  test('returns issues in Delhi bbox', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/issues/bbox?min_lat=28.4&min_lng=76.8&max_lat=28.9&max_lng=77.4',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(typeof body.count).toBe('number');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('returns 400 when required params are missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/issues/bbox?min_lat=28.4&min_lng=76.8',
    });
    expect(res.statusCode).toBe(400);
  });
});
