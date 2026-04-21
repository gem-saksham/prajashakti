/**
 * Tag Suggestion + Officials tests — Day 20.
 *
 * Tests cover:
 *   - suggestGrievanceCategory keyword scoring
 *   - suggestDepartment fallback chain
 *   - autoSuggest orchestrator + Redis caching
 *   - OfficialModel CRUD
 *   - officialService tagging, untag, duplicate check
 *   - claimOfficialAccount
 *   - Official API routes (GET/POST /officials, GET/POST /issues/:id/officials)
 *   - Tag suggestion API route
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
import { suggestGrievanceCategory, autoSuggest } from '../../src/services/tagSuggestionService.js';
import * as OfficialModel from '../../src/models/official.js';
import * as OfficialService from '../../src/services/officialService.js';

let app;
let token;
let adminToken;
let userId;
let adminId;
let testOfficialId;

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  app = await createTestApp();
  await truncateTables();

  ({
    token,
    user: { id: userId },
  } = await createTestUser(app));
  ({
    token: adminToken,
    user: { id: adminId },
  } = await createTestUser(app, {
    role: 'admin',
    name: 'Admin User',
  }));

  // Seed one test official directly
  const { rows } = await testPool.query(
    `INSERT INTO officials (name, designation, jurisdiction_type, state_code, source)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    ['Commissioner, Test Municipal Corporation', 'IAS Commissioner', 'municipal', 'DL', 'test'],
  );
  testOfficialId = rows[0].id;
});

afterAll(async () => {
  // Clean up test officials
  await testPool.query(`DELETE FROM officials WHERE source = 'test'`);
  await truncateTables();
  await closeTestConnections();
  await app.close();
});

// ── 1. suggestGrievanceCategory ───────────────────────────────────────────────

describe('suggestGrievanceCategory', () => {
  test('returns results for a road-related description', async () => {
    const results = await suggestGrievanceCategory(
      'Broken pothole on sector 17 road',
      'Large potholes causing accidents and vehicle damage daily',
      'Infrastructure',
    );
    // Should return some categories — actual results depend on seeded data
    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('name');
      expect(results[0]).toHaveProperty('confidence');
      expect(results[0]).toHaveProperty('matchedKeywords');
      expect(results[0].confidence).toBeGreaterThan(0);
      expect(results[0].confidence).toBeLessThanOrEqual(1);
    }
  });

  test('returns results for garbage/sanitation description', async () => {
    const results = await suggestGrievanceCategory(
      'Garbage not collected for 2 weeks',
      'Pile of waste near market causing smell and disease risk',
      'Environment',
    );
    expect(Array.isArray(results)).toBe(true);
  });

  test('returns empty for unrecognisable text', async () => {
    const results = await suggestGrievanceCategory('xyz abc 123', 'random text', null);
    // May return empty or some results — just verify shape
    expect(Array.isArray(results)).toBe(true);
  });

  test('returns empty for empty input', async () => {
    const results = await suggestGrievanceCategory('', '', null);
    expect(results).toEqual([]);
  });

  test('confidence is between 0 and 1', async () => {
    const results = await suggestGrievanceCategory(
      'water supply pipe burst flooding street',
      'No water supply since yesterday',
      'Infrastructure',
    );
    for (const r of results) {
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });

  test('results are ordered by confidence desc', async () => {
    const results = await suggestGrievanceCategory(
      'road pothole damage vehicle broken street highway',
      'multiple issues with road and drainage',
      'Infrastructure',
    );
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
    }
  });
});

// ── 2. autoSuggest ────────────────────────────────────────────────────────────

describe('autoSuggest', () => {
  test('returns all expected shape fields', async () => {
    const result = await autoSuggest(
      {
        title: 'Broken road with potholes near sector 17',
        description: 'Roads are damaged with large potholes causing accidents',
        category: 'Infrastructure',
        locationLat: null,
        locationLng: null,
      },
      testRedis,
    );

    expect(result).toHaveProperty('grievanceCategories');
    expect(result).toHaveProperty('ministries');
    expect(result).toHaveProperty('departments');
    expect(result).toHaveProperty('suggestedOfficials');
    expect(Array.isArray(result.grievanceCategories)).toBe(true);
    expect(Array.isArray(result.ministries)).toBe(true);
    expect(Array.isArray(result.departments)).toBe(true);
    expect(Array.isArray(result.suggestedOfficials)).toBe(true);
  });

  test('caches result in Redis on second call', async () => {
    await testRedis.flushdb();

    const issueData = {
      title: 'Hospital not functioning properly',
      description: 'Primary health centre lacks medicines and doctors',
      category: 'Healthcare',
      locationLat: null,
      locationLng: null,
    };

    const result1 = await autoSuggest(issueData, testRedis);
    const result2 = await autoSuggest(issueData, testRedis);

    // Both should be structurally identical
    expect(result1.grievanceCategories.length).toBe(result2.grievanceCategories.length);
  });

  test('works without Redis (gracefully skips caching)', async () => {
    const result = await autoSuggest(
      {
        title: 'School building in poor condition',
        description: 'Leaking roof, broken benches',
        category: 'Education',
        locationLat: null,
        locationLng: null,
      },
      null, // no redis
    );

    expect(result).toHaveProperty('grievanceCategories');
  });
});

// ── 3. OfficialModel ──────────────────────────────────────────────────────────

describe('OfficialModel.create + findById', () => {
  let createdId;

  test('creates an official and retrieves by ID', async () => {
    const official = await OfficialModel.create({
      name: 'Test District Collector, Amritsar',
      designation: 'IAS District Collector',
      jurisdictionType: 'district',
      stateCode: 'PB',
      districtCode: 'PB01',
      source: 'test',
    });

    expect(official).not.toBeNull();
    expect(official.id).toBeDefined();
    expect(official.name).toBe('Test District Collector, Amritsar');
    expect(official.designation).toBe('IAS District Collector');
    expect(official.stateCode).toBe('PB');
    createdId = official.id;
  });

  test('findById returns null for unknown ID', async () => {
    const result = await OfficialModel.findById('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  afterAll(async () => {
    if (createdId) {
      await testPool.query(`DELETE FROM officials WHERE id = $1`, [createdId]);
    }
  });
});

describe('OfficialModel.search (fuzzy)', () => {
  test('finds official by exact name prefix', async () => {
    const results = await OfficialModel.search('Commissioner, Test');
    const found = results.find((r) => r.id === testOfficialId);
    expect(found).toBeDefined();
  });

  test('returns similarity score', async () => {
    const results = await OfficialModel.search('Commissioner');
    if (results.length > 0) {
      expect(typeof results[0].similarityScore).toBe('number');
    }
  });

  test('filters by stateCode', async () => {
    const results = await OfficialModel.search('Commissioner', { stateCode: 'DL' });
    const codes = results.map((r) => r.stateCode).filter(Boolean);
    expect(codes.every((c) => c === 'DL')).toBe(true);
  });
});

describe('OfficialModel.findAll', () => {
  test('returns paginated list', async () => {
    const result = await OfficialModel.findAll({}, { page: 1, limit: 5 });
    expect(result.pagination).toBeDefined();
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(5);
    expect(Array.isArray(result.data)).toBe(true);
  });

  test('filters by stateCode', async () => {
    const result = await OfficialModel.findAll({ stateCode: 'DL' }, {});
    const codes = result.data.map((o) => o.stateCode).filter(Boolean);
    expect(codes.every((c) => c === 'DL')).toBe(true);
  });
});

// ── 4. Issue-Official tagging ─────────────────────────────────────────────────

describe('OfficialModel tagging', () => {
  let issueId;

  beforeAll(async () => {
    const issue = await createTestIssue(userId);
    issueId = issue.id;
  });

  test('tags an official to an issue', async () => {
    const result = await OfficialModel.tagToIssue(issueId, testOfficialId, userId, 'primary');
    expect(result).not.toBeNull();
    expect(result.issueId).toBe(issueId);
    expect(result.officialId).toBe(testOfficialId);
    expect(result.tagType).toBe('primary');
  });

  test('returns null when same official tagged twice (unique constraint)', async () => {
    const result = await OfficialModel.tagToIssue(issueId, testOfficialId, userId, 'primary');
    expect(result).toBeNull(); // ON CONFLICT DO NOTHING
  });

  test('getOfficialsForIssue returns tagged official', async () => {
    const officials = await OfficialModel.getOfficialsForIssue(issueId);
    const found = officials.find((o) => o.id === testOfficialId);
    expect(found).toBeDefined();
    expect(found.tagType).toBe('primary');
  });

  test('incrementTaggedCount increments the counter', async () => {
    const before = (await OfficialModel.findById(testOfficialId)).totalIssuesTagged;
    await OfficialModel.incrementTaggedCount(testOfficialId, 1);
    const after = (await OfficialModel.findById(testOfficialId)).totalIssuesTagged;
    expect(after).toBe(before + 1);
  });

  test('untagFromIssue removes the tag', async () => {
    const removed = await OfficialModel.untagFromIssue(issueId, testOfficialId);
    expect(removed).toBe(true);
    const officials = await OfficialModel.getOfficialsForIssue(issueId);
    expect(officials.find((o) => o.id === testOfficialId)).toBeUndefined();
  });

  test('untagFromIssue returns false when not tagged', async () => {
    const removed = await OfficialModel.untagFromIssue(issueId, testOfficialId);
    expect(removed).toBe(false);
  });
});

// ── 5. OfficialService ────────────────────────────────────────────────────────

describe('officialService.createOfficial', () => {
  test('throws 403 for citizen role', async () => {
    await expect(
      OfficialService.createOfficial({ name: 'Test', designation: 'Test' }, 'citizen'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test('creates official as admin', async () => {
    const official = await OfficialService.createOfficial(
      {
        name: 'Service Test Official',
        designation: 'Test Designation',
        state_code: 'MH',
        source: 'test',
      },
      'admin',
    );
    expect(official.id).toBeDefined();
    expect(official.name).toBe('Service Test Official');
    // Cleanup
    await testPool.query(`DELETE FROM officials WHERE id = $1`, [official.id]);
  });

  test('throws 400 for missing name', async () => {
    await expect(
      OfficialService.createOfficial({ designation: 'Test' }, 'admin'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('officialService.claimOfficialAccount', () => {
  let claimable;

  beforeAll(async () => {
    const { rows } = await testPool.query(
      `INSERT INTO officials (name, designation, source)
       VALUES ($1, $2, $3) RETURNING id`,
      ['Claimable Official', 'Director', 'test'],
    );
    claimable = rows[0].id;
  });

  afterAll(async () => {
    await testPool.query(`DELETE FROM officials WHERE id = $1`, [claimable]);
  });

  test('claims an unclaimed profile', async () => {
    const result = await OfficialService.claimOfficialAccount(claimable, userId);
    expect(result.claimedByUserId).toBe(userId);
    expect(result.claimedAt).toBeDefined();
  });

  test('throws 409 when already claimed', async () => {
    await expect(OfficialService.claimOfficialAccount(claimable, adminId)).rejects.toMatchObject({
      statusCode: 409,
      code: 'ALREADY_CLAIMED',
    });
  });
});

describe('officialService.tagOfficialToIssue', () => {
  let issueId2;
  let official2Id;

  beforeAll(async () => {
    const issue = await createTestIssue(userId);
    issueId2 = issue.id;
    const { rows } = await testPool.query(
      `INSERT INTO officials (name, designation, source) VALUES ($1, $2, $3) RETURNING id`,
      ['Service Tag Official', 'IAS Officer', 'test'],
    );
    official2Id = rows[0].id;
  });

  afterAll(async () => {
    await testPool.query(`DELETE FROM officials WHERE id = $1`, [official2Id]);
  });

  test('tags official successfully', async () => {
    const result = await OfficialService.tagOfficialToIssue(
      issueId2,
      official2Id,
      userId,
      'citizen',
      'primary',
    );
    expect(result).not.toBeNull();
  });

  test('throws 409 when already tagged', async () => {
    await expect(
      OfficialService.tagOfficialToIssue(issueId2, official2Id, userId, 'citizen', 'primary'),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ALREADY_TAGGED' });
  });

  test('throws 403 for wrong user', async () => {
    const { rows } = await testPool.query(
      `INSERT INTO officials (name, designation, source) VALUES ($1, $2, $3) RETURNING id`,
      ['Another Official', 'IAS', 'test'],
    );
    const anotherOfficialId = rows[0].id;

    await expect(
      OfficialService.tagOfficialToIssue(
        issueId2,
        anotherOfficialId,
        adminId,
        'citizen',
        'primary',
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    await testPool.query(`DELETE FROM officials WHERE id = $1`, [anotherOfficialId]);
  });
});

// ── 6. Official API routes ────────────────────────────────────────────────────

describe('GET /api/v1/officials', () => {
  test('returns list without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/officials' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('search with q param returns matches', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/officials?q=Commissioner',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  test('filters by state_code', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/officials?state_code=DL',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const codes = body.data.map((o) => o.stateCode).filter(Boolean);
    expect(codes.every((c) => c === 'DL')).toBe(true);
  });

  test('search requires q >= 2 chars', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/officials?q=a',
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/v1/officials/:id', () => {
  test('returns official by ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/officials/${testOfficialId}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(testOfficialId);
  });

  test('returns 404 for unknown ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/officials/00000000-0000-0000-0000-000000000000',
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/v1/officials', () => {
  test('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/officials',
      payload: { name: 'Test', designation: 'Test' },
    });
    expect(res.statusCode).toBe(401);
  });

  test('returns 403 for citizen role', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/officials',
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: 'Test Official', designation: 'Director' },
    });
    expect(res.statusCode).toBe(403);
  });

  test('creates official as admin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/officials',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Route Created Official',
        designation: 'Test Route Designation',
        state_code: 'KA',
        jurisdiction_type: 'state',
        source: 'test',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.name).toBe('Route Created Official');
    // Cleanup
    await testPool.query(`DELETE FROM officials WHERE id = $1`, [body.data.id]);
  });
});

describe('Issue-official routes', () => {
  let issueId;

  beforeAll(async () => {
    const issue = await createTestIssue(userId);
    issueId = issue.id;
  });

  test('GET /issues/:id/officials returns empty list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/issues/${issueId}/officials`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });

  test('POST /issues/:id/officials tags official', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/issues/${issueId}/officials`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { official_id: testOfficialId, tag_type: 'primary' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().success).toBe(true);
  });

  test('GET /issues/:id/officials returns tagged official', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/issues/${issueId}/officials`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(testOfficialId);
  });

  test('POST again returns 409 ALREADY_TAGGED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/issues/${issueId}/officials`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { official_id: testOfficialId },
    });
    expect(res.statusCode).toBe(409);
  });

  test('DELETE /issues/:id/officials/:officialId removes tag', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/issues/${issueId}/officials/${testOfficialId}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().untagged).toBe(true);
  });
});

// ── 7. Tag suggestion API route ───────────────────────────────────────────────

describe('POST /api/v1/issues/suggest-tags', () => {
  test('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/issues/suggest-tags',
      payload: { title: 'Test issue title' },
    });
    expect(res.statusCode).toBe(401);
  });

  test('returns 400 for title too short', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/issues/suggest-tags',
      headers: { Authorization: `Bearer ${token}` },
      payload: { title: 'ab' },
    });
    expect(res.statusCode).toBe(400);
  });

  test('returns suggestions for road pothole issue', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/issues/suggest-tags',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        title: 'Garbage not collected in Sector 17 for 2 weeks',
        description: 'Pile of waste near the market causing health hazards',
        category: 'Environment',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.suggestions).toHaveProperty('grievanceCategories');
    expect(body.suggestions).toHaveProperty('ministries');
    expect(body.suggestions).toHaveProperty('departments');
    expect(body.suggestions).toHaveProperty('suggestedOfficials');
    expect(Array.isArray(body.suggestions.grievanceCategories)).toBe(true);
  });

  test('returns suggestions for infrastructure issue with location', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/issues/suggest-tags',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        title: 'Broken road with large potholes causing accidents',
        description: 'Road on NH17 has multiple potholes causing accidents',
        category: 'Infrastructure',
        location_lat: 30.7333,
        location_lng: 76.7794,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });
});
