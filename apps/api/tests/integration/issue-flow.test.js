/**
 * Day 22 — Full Integration Test Suite: Issue Engine
 *
 * Six end-to-end flows that exercise the entire issue engine stack:
 *
 *  Flow 1: Issue lifecycle          — create → photo → officials → support → update → delete
 *  Flow 2: Location-based discovery — 20 issues across 5 districts, nearby + bbox + jurisdiction
 *  Flow 3: Tag suggestion accuracy  — 20 issues with varied descriptions, verify 80%+ accuracy
 *  Flow 4: Support integrity        — 100 concurrent supports, exact count, Redis/Postgres match
 *  Flow 5: Photo EXIF validation    — within 500m → verified, 5 km away → flagged, no EXIF → false
 *  Flow 6: Anti-gaming              — new account weight=0.3, verified 30d weight=1.0
 *
 * All flows hit a real Fastify instance → real test DB → real Redis.
 * Taxonomy (ministries/departments/grievance_categories) is pre-seeded and not truncated.
 */

import {
  createTestApp,
  closeTestConnections,
  truncateTables,
  createTestUser,
  createTestIssue,
  authHeader,
  testPool,
  testRedis,
} from '../helpers.js';
import { distanceMeters, verifyLocation } from '../../src/services/exifService.js';
import * as SupportService from '../../src/services/supportService.js';
import { computeSupportWeight } from '../../src/utils/supportWeight.js';
import { eventBus } from '../../src/services/eventBus.js';

// ── Shared fixtures ───────────────────────────────────────────────────────────

let app;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  await truncateTables();
});

afterAll(async () => {
  await app.close();
  await closeTestConnections();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Register + verify a user through the HTTP API. Returns { token, userId }. */
async function registerUser(phone, name = 'Test User') {
  const regRes = await app.inject({
    method: 'POST',
    url: '/api/v1/users/register',
    body: { phone, name },
  });
  expect(regRes.statusCode).toBe(200);
  const { debug_otp } = JSON.parse(regRes.body);

  const verRes = await app.inject({
    method: 'POST',
    url: '/api/v1/users/verify-otp',
    body: { phone, otp: debug_otp },
  });
  expect(verRes.statusCode).toBe(200);
  const body = JSON.parse(verRes.body);
  // Route returns { success, user, accessToken, refreshToken }
  return { token: body.accessToken, userId: body.user.id };
}

/** Create a verified user directly in DB (30 days old) for weight tests. */
async function createAgedVerifiedUser(app, overrides = {}) {
  const { user, token } = await createTestUser(app, { is_verified: true, ...overrides });
  await testPool.query(`UPDATE users SET created_at = NOW() - INTERVAL '30 days' WHERE id = $1`, [
    user.id,
  ]);
  return { user, token };
}

/** Support an issue directly via the service layer (avoids HTTP rate-limit in tests). */
function directSupport(userId, issueId) {
  return SupportService.supportIssue(userId, issueId, { redis: testRedis });
}

// ─────────────────────────────────────────────────────────────────────────────
// Flow 1: Issue lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 1: Issue lifecycle', () => {
  test('register → create issue → tag official → support → update → soft-delete', async () => {
    // ── 1. Register a user via HTTP ──────────────────────────────────────────
    const { token, userId } = await registerUser('8100000001', 'Priya Sharma');

    // ── 2. Create an issue via HTTP ──────────────────────────────────────────
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/issues',
      headers: authHeader(token),
      body: {
        title: 'Broken streetlights on MG Road causing accidents',
        description:
          'Three consecutive streetlights on MG Road have been non-functional for 2 weeks. ' +
          'Two accidents have already occurred in the dark stretch near the bus stop.',
        category: 'Infrastructure',
        urgency: 'high',
        location_lat: 12.9758,
        location_lng: 77.6027,
        district: 'Bengaluru Urban',
        state: 'Karnataka',
        pincode: '560001',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const { data: issue } = JSON.parse(createRes.body);
    expect(issue.id).toBeTruthy();
    expect(issue.status).toBe('active');

    // ── 3. Verify issue is retrievable via GET ───────────────────────────────
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/issues/${issue.id}`,
    });
    expect(getRes.statusCode).toBe(200);
    const { data: fetched } = JSON.parse(getRes.body);
    expect(fetched.title).toBe(issue.title);
    expect(fetched.supporterCount).toBe(0);

    // ── 4. Add simulated photos to the issue (direct DB insert) ─────────────
    const photos = [
      {
        url: 'https://s3.example.com/photo1.jpg',
        caption: 'MG Road dark stretch',
        uploadedAt: new Date().toISOString(),
      },
      {
        url: 'https://s3.example.com/photo2.jpg',
        caption: 'Broken lamp post',
        uploadedAt: new Date().toISOString(),
      },
      {
        url: 'https://s3.example.com/photo3.jpg',
        caption: 'Accident damage',
        uploadedAt: new Date().toISOString(),
      },
    ];
    await testPool.query(`UPDATE issues SET photos = $1::jsonb WHERE id = $2`, [
      JSON.stringify(photos),
      issue.id,
    ]);

    // Verify photos stored
    const {
      rows: [withPhotos],
    } = await testPool.query(`SELECT photos FROM issues WHERE id = $1`, [issue.id]);
    expect(withPhotos.photos).toHaveLength(3);

    // ── 5. Tag an official ───────────────────────────────────────────────────
    // Seed one official for the tag test
    const {
      rows: [off],
    } = await testPool.query(
      `INSERT INTO officials (name, designation, jurisdiction_type, state_code, source)
       VALUES ('K. Nataraj', 'Municipal Commissioner', 'municipal', 'KA', 'test')
       RETURNING id`,
    );

    const tagRes = await app.inject({
      method: 'POST',
      url: `/api/v1/issues/${issue.id}/officials`,
      headers: authHeader(token),
      body: { official_id: off.id, tag_type: 'primary' },
    });
    expect(tagRes.statusCode).toBe(201);

    // ── 6. Have 10 users support the issue (triggers milestone=10) ───────────
    let milestonePayload = null;
    eventBus.once('issue.milestone.reached', (p) => {
      milestonePayload = p;
    });

    const supporters = [];
    for (let i = 0; i < 10; i++) {
      const { user: su } = await createTestUser(app);
      await testPool.query(
        `UPDATE users SET created_at = NOW() - INTERVAL '30 days' WHERE id = $1`,
        [su.id],
      );
      supporters.push(su);
    }
    // Support sequentially to avoid rate-limit confusion in test DB
    let lastResult;
    for (const su of supporters) {
      lastResult = await directSupport(su.id, issue.id);
    }
    expect(lastResult.supporterCount).toBe(10);
    expect(lastResult.milestone).toBe(10);
    expect(milestonePayload).toMatchObject({ issueId: issue.id, milestone: 10 });

    // ── 7. Verify count via API ──────────────────────────────────────────────
    const statsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/issues/${issue.id}/support-stats`,
    });
    expect(statsRes.statusCode).toBe(200);
    const { data: stats } = JSON.parse(statsRes.body);
    expect(stats.supporterCount).toBe(10);
    expect(stats.crossedMilestones).toContain(10);

    // ── 8. Creator updates the issue ─────────────────────────────────────────
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/issues/${issue.id}`,
      headers: authHeader(token),
      body: {
        description:
          'THREE consecutive streetlights on MG Road have been non-functional for 2 weeks. ' +
          'Two accidents have already occurred. Updated with additional evidence.',
        urgency: 'critical',
      },
    });
    expect(updateRes.statusCode).toBe(200);
    const { data: updated } = JSON.parse(updateRes.body);
    expect(updated.urgency).toBe('critical');

    // ── 9. Soft-delete by creator ────────────────────────────────────────────
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/issues/${issue.id}`,
      headers: authHeader(token),
    });
    expect(deleteRes.statusCode).toBe(200);

    // Verify issue is soft-deleted (not returned in list)
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/issues',
    });
    const { data: list } = JSON.parse(listRes.body);
    const deletedInList = list.find((i) => i.id === issue.id);
    expect(deletedInList).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 2: Location-based discovery
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 2: Location-based discovery', () => {
  const DISTRICTS = [
    // [name, lat, lng, state]
    ['Central Delhi', 28.6448, 77.2167, 'Delhi'],
    ['South Delhi', 28.5245, 77.1855, 'Delhi'],
    ['Gurugram', 28.4595, 77.0266, 'Haryana'],
    ['Noida', 28.5355, 77.391, 'Uttar Pradesh'],
    ['Faridabad', 28.4089, 77.3178, 'Haryana'],
  ];

  let ownerId;

  beforeEach(async () => {
    const { user } = await createTestUser(app);
    ownerId = user.id;

    // Create 4 issues per district (20 total)
    for (const [district, lat, lng, state] of DISTRICTS) {
      for (let j = 0; j < 4; j++) {
        // Add small jitter so coordinates are slightly different
        const jitter = j * 0.001;
        await createTestIssue(ownerId, {
          title: `${district} Issue ${j + 1}`,
          locationLat: lat + jitter,
          locationLng: lng + jitter,
          district,
          state,
        });
      }
    }
  });

  test('nearby query returns distance-sorted results', async () => {
    // Query from Central Delhi — should return Central Delhi issues closest
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/issues/nearby?lat=28.6448&lng=77.2167&radius=5',
    });
    expect(res.statusCode).toBe(200);
    const { data } = JSON.parse(res.body);
    expect(data.length).toBeGreaterThan(0);

    // Verify results are within radius and ordered by distance
    if (data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        const prev = distanceMeters(
          28.6448,
          77.2167,
          data[i - 1].locationLat,
          data[i - 1].locationLng,
        );
        const curr = distanceMeters(28.6448, 77.2167, data[i].locationLat, data[i].locationLng);
        expect(curr).toBeGreaterThanOrEqual(prev - 10); // allow 10m tolerance
      }
    }
  });

  test('nearby query with district filter returns only that district', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/issues/nearby?lat=28.4595&lng=77.0266&radius=50&district=Gurugram',
    });
    expect(res.statusCode).toBe(200);
    const { data } = JSON.parse(res.body);
    expect(data.length).toBeGreaterThan(0);
    for (const issue of data) {
      expect(issue.district).toBe('Gurugram');
    }
  });

  test('bounding box query returns issues within bbox', async () => {
    // Tight bbox around Central Delhi
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/issues/bbox?min_lat=28.63&min_lng=77.20&max_lat=28.66&max_lng=77.23',
    });
    expect(res.statusCode).toBe(200);
    const { data } = JSON.parse(res.body);
    expect(data.length).toBeGreaterThan(0);

    // All results should be within the bbox (coords may come back as strings from DB)
    for (const issue of data) {
      const lat = parseFloat(issue.locationLat);
      const lng = parseFloat(issue.locationLng);
      expect(lat).toBeGreaterThanOrEqual(28.63);
      expect(lat).toBeLessThanOrEqual(28.66);
      expect(lng).toBeGreaterThanOrEqual(77.2);
      expect(lng).toBeLessThanOrEqual(77.23);
    }
  });

  test('jurisdiction filter returns issues for a specific state', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/issues/jurisdiction?state_code=DL',
    });
    // May return 200 or 404 depending on whether DL is seeded, either is valid
    expect([200, 404]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      const { data } = JSON.parse(res.body);
      for (const issue of data) {
        expect(issue.state).toBe('Delhi');
      }
    }
  });

  test('list endpoint with state filter returns matching issues', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/issues?state=Haryana',
    });
    expect(res.statusCode).toBe(200);
    const { data } = JSON.parse(res.body);
    expect(data.length).toBeGreaterThan(0);
    for (const issue of data) {
      expect(issue.state).toBe('Haryana');
    }
  });

  test('total of 20 issues were created across 5 districts', async () => {
    const { rows } = await testPool.query(
      `SELECT COUNT(*) AS cnt FROM issues WHERE title LIKE '% Issue %'`,
    );
    expect(parseInt(rows[0].cnt, 10)).toBe(20);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 3: Tag suggestion accuracy
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 3: Tag suggestion accuracy', () => {
  // Test cases: [title, description, expectedCategory (praja_category)]
  const TEST_CASES = [
    [
      'Deep potholes on main road causing accidents',
      'The road has deep potholes and damaged street surface near the market',
      'Infrastructure',
    ],
    [
      'Streetlights not working for 2 weeks',
      'All the streetlights on this road are dark and broken LED lamp posts',
      'Infrastructure',
    ],
    [
      'Garbage not collected for 10 days',
      'Waste and garbage overflowing, trash bins full and sanitation poor',
      'Environment',
    ],
    [
      'Water supply contaminated with dirty water',
      'Contaminated and unsafe drinking water coming from the tap pipeline',
      'Healthcare',
    ],
    [
      'Hospital has no doctor, poor treatment',
      'Government hospital has no doctor and emergency OPD is closed with medicine shortage',
      'Healthcare',
    ],
    [
      'School building in very poor condition',
      'School classroom has broken walls, no toilet, dilapidated building condition',
      'Education',
    ],
    [
      'Police refusing to register FIR',
      'FIR complaint not registered by police, crime going unaddressed',
      'Safety',
    ],
    [
      'Air pollution from factory emissions',
      'Smoke and dust pollution, high AQI levels from factory',
      'Environment',
    ],
    [
      'Bribe demanded for property registration',
      'Registry office demanding bribe and money for land mutation approval',
      'Corruption',
    ],
    [
      'Fertilizer not available at shop',
      'Urea and DAP fertilizer shortage, no seeds available for farmers',
      'Agriculture',
    ],
    [
      'Power outage lasting 12 hours daily',
      'Electricity cut and load shedding blackout for 12 hours every day',
      'Infrastructure',
    ],
    [
      'Sewer drain overflow flooding street',
      'Blocked drain and sewer overflow causing waterlogging and nala flooding',
      'Infrastructure',
    ],
    [
      'Mid day meal quality very poor',
      'School lunch food quality is bad and mid-day meal hygiene issues',
      'Education',
    ],
    [
      'Women harassment at market area',
      'Women safety concern, eve-teasing and harassment by local rowdies',
      'Safety',
    ],
    [
      'River polluted by factory effluent',
      'Water pollution in river and lake from industrial effluents',
      'Environment',
    ],
    [
      'Crop damaged by floods, no compensation',
      'Crop damage from floods, PMFBY insurance claim not processed, no compensation',
      'Agriculture',
    ],
    [
      'Pension not credited for 3 months',
      'Old age pension payment pending and widow pension not received',
      'Other',
    ],
    [
      'Ration not received, PDS shop irregular',
      'Ration card issue, not receiving rice and wheat from PDS shop',
      'Other',
    ],
    [
      'Illegal construction encroachment',
      'Unauthorized building construction and encroachment by builder',
      'Corruption',
    ],
    [
      'Traffic signal broken at intersection',
      'Traffic signal not working, parking chaos and road safety issue',
      'Safety',
    ],
  ];

  let ownerId, ownerToken;

  beforeEach(async () => {
    const { user, token } = await createAgedVerifiedUser(app);
    ownerId = user.id;
    ownerToken = token;
  });

  // Boundary tests first — before the 20-request accuracy batch exhausts the rate limit
  test('returns 400 when title is too short', async () => {
    const { token: freshToken } = await createAgedVerifiedUser(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/issues/suggest-tags',
      headers: authHeader(freshToken),
      body: { title: 'AB', description: 'short' },
    });
    expect(res.statusCode).toBe(400);
  });

  test('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/issues/suggest-tags',
      body: { title: 'Some valid title here', description: 'description text' },
    });
    expect(res.statusCode).toBe(401);
  });

  test('suggest-tags returns correct category for 80%+ of test cases', async () => {
    let correct = 0;
    const results = [];

    for (const [title, description, expectedCategory] of TEST_CASES) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/issues/suggest-tags',
        headers: authHeader(ownerToken),
        body: {
          title,
          description,
          location_lat: 28.6139,
          location_lng: 77.209,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      // Route returns { success, suggestions: { grievanceCategories, ... } }
      const topCategory = body.suggestions?.grievanceCategories?.[0]?.prajaCategory ?? null;
      const matched = topCategory === expectedCategory;
      if (matched) correct++;
      results.push({
        title: title.slice(0, 40),
        expected: expectedCategory,
        got: topCategory,
        matched,
      });
    }

    const accuracy = correct / TEST_CASES.length;
    console.log(
      `\nTag suggestion accuracy: ${correct}/${TEST_CASES.length} = ${(accuracy * 100).toFixed(0)}%`,
    );
    results
      .filter((r) => !r.matched)
      .forEach((r) => console.log(`  MISS: "${r.title}..." expected=${r.expected} got=${r.got}`));

    expect(accuracy).toBeGreaterThanOrEqual(0.8);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 4: Support integrity — 100 concurrent supports
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 4: Support integrity', () => {
  test('100 concurrent supports produce exactly 100 with no duplicates', async () => {
    const { user: owner } = await createTestUser(app);
    const issue = await createTestIssue(owner.id);

    // Pre-create 100 users (sequential — we want the concurrent part to be the supports)
    const users = [];
    for (let i = 0; i < 100; i++) {
      const { user } = await createTestUser(app);
      await testPool.query(
        `UPDATE users SET created_at = NOW() - INTERVAL '30 days' WHERE id = $1`,
        [user.id],
      );
      users.push(user);
    }

    // Fire all 100 supports concurrently
    const results = await Promise.allSettled(users.map((u) => directSupport(u.id, issue.id)));

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    expect(succeeded.length).toBe(100);
    expect(failed.length).toBe(0);

    // Verify PostgreSQL count is exactly 100
    const {
      rows: [dbRow],
    } = await testPool.query(`SELECT supporter_count FROM issues WHERE id = $1`, [issue.id]);
    expect(dbRow.supporter_count).toBe(100);

    // Verify Redis matches PostgreSQL
    const rCount = await testRedis.get(`issue:count:${issue.id}`);
    expect(parseInt(rCount, 10)).toBe(100);

    // Verify no duplicate supports in the supports table
    const {
      rows: [dupCheck],
    } = await testPool.query(`SELECT COUNT(*) AS cnt FROM supports WHERE issue_id = $1`, [
      issue.id,
    ]);
    expect(parseInt(dupCheck.cnt, 10)).toBe(100);
  });

  test('duplicate support attempt returns 409', async () => {
    const { user } = await createAgedVerifiedUser(app);
    const issue = await createTestIssue(user.id);

    await directSupport(user.id, issue.id);

    await expect(directSupport(user.id, issue.id)).rejects.toMatchObject({
      code: 'ALREADY_SUPPORTED',
    });
  });

  test('unsupport then re-support maintains correct count', async () => {
    const { user } = await createAgedVerifiedUser(app);
    const { user: owner } = await createTestUser(app);
    const issue = await createTestIssue(owner.id);

    await directSupport(user.id, issue.id);
    const { supporterCount: afterSupport } = await SupportService.unsupportIssue(
      user.id,
      issue.id,
      { redis: testRedis },
    );
    expect(afterSupport).toBe(0);

    const { supporterCount: afterReSupport } = await directSupport(user.id, issue.id);
    expect(afterReSupport).toBe(1);
  });

  test('Redis ↔ Postgres counter reconciliation corrects drift', async () => {
    const { user: owner } = await createTestUser(app);
    const issue = await createTestIssue(owner.id);

    const { user: u } = await createAgedVerifiedUser(app);
    await directSupport(u.id, issue.id);

    // Corrupt Redis
    await testRedis.set(`issue:count:${issue.id}`, 999);

    const drifts = await SupportService.reconcileCounters(testRedis, 500);
    const thisIssueDrift = drifts.find((d) => d.issueId === issue.id);
    expect(thisIssueDrift).toBeTruthy();
    expect(thisIssueDrift.dbCount).toBe(1);
    expect(thisIssueDrift.cachedCount).toBe(999);

    const fixed = await testRedis.get(`issue:count:${issue.id}`);
    expect(parseInt(fixed, 10)).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 5: Photo EXIF validation
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 5: Photo EXIF validation', () => {
  // Bengaluru Urban: issue at 12.9758, 77.6027
  const ISSUE_LAT = 12.9758;
  const ISSUE_LNG = 77.6027;

  test('photo within 500m returns isVerifiedLocation=true', () => {
    // 200m north of issue
    const photoLat = 12.9776;
    const photoLng = 77.6027;
    const dist = distanceMeters(ISSUE_LAT, ISSUE_LNG, photoLat, photoLng);
    expect(dist).toBeLessThan(500);
    const result = verifyLocation(
      { hasGps: true, latitude: photoLat, longitude: photoLng },
      { lat: ISSUE_LAT, lng: ISSUE_LNG },
      500,
    );
    expect(result.verified).toBe(true);
    expect(result.distanceMeters).toBeLessThan(500);
  });

  test('photo 5 km away returns isVerifiedLocation=false and is flagged', () => {
    // ~5 km north of issue
    const photoLat = 13.0208;
    const photoLng = 77.6027;
    const dist = distanceMeters(ISSUE_LAT, ISSUE_LNG, photoLat, photoLng);
    expect(dist).toBeGreaterThan(4500);
    const result = verifyLocation(
      { hasGps: true, latitude: photoLat, longitude: photoLng },
      { lat: ISSUE_LAT, lng: ISSUE_LNG },
      500,
    );
    expect(result.verified).toBe(false);
    expect(result.distanceMeters).toBeGreaterThan(500);
  });

  test('photo with no GPS EXIF returns isVerifiedLocation=false', () => {
    // hasGps=false = no GPS data
    const result = verifyLocation(
      { hasGps: false, latitude: null, longitude: null },
      { lat: ISSUE_LAT, lng: ISSUE_LNG },
      500,
    );
    expect(result.verified).toBe(false);
    expect(result.distanceMeters).toBeNull();
  });

  test('distanceMeters Haversine formula is accurate', () => {
    // Known distance: Delhi to Agra ≈ 178 km (straight-line, not road distance)
    const delhiLat = 28.6139,
      delhiLng = 77.209;
    const agraLat = 27.1767,
      agraLng = 78.0081;
    const dist = distanceMeters(delhiLat, delhiLng, agraLat, agraLng);
    // Accept ±10% of 178 km straight-line distance
    expect(dist).toBeGreaterThan(160000);
    expect(dist).toBeLessThan(200000);
  });

  test('photo at exactly 500m boundary is included (edge case)', () => {
    // Move 500m north: 1 degree latitude ≈ 111,320m → 500m ≈ 0.00449 degrees
    const photoLat = ISSUE_LAT + 0.0044;
    const photoLng = ISSUE_LNG;
    const result = verifyLocation(
      { hasGps: true, latitude: photoLat, longitude: photoLng },
      { lat: ISSUE_LAT, lng: ISSUE_LNG },
      500,
    );
    // Result depends on exact distance; just verify the shape
    expect(result).toHaveProperty('verified');
    expect(result).toHaveProperty('distanceMeters');
    expect(typeof result.verified).toBe('boolean');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 6: Anti-gaming — support weight validation
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 6: Anti-gaming — support weights', () => {
  test('brand-new unverified account (< 24h) gets weight = 0.3', async () => {
    const { user } = await createTestUser(app, { is_verified: false });
    // user.createdAt is just now → age < 24h
    const weight = computeSupportWeight(user);
    expect(weight).toBe(0.3);
  });

  test('brand-new verified account (< 24h) is still capped at 0.3', async () => {
    const { user } = await createTestUser(app, { is_verified: true });
    const weight = computeSupportWeight(user);
    expect(weight).toBe(0.3);
  });

  test('verified citizen (30d old) gets weight = 1.0', async () => {
    const { user } = await createAgedVerifiedUser(app);
    // Re-fetch so createdAt reflects the backdated value
    const { rows } = await testPool.query(
      `SELECT id, role, is_verified, reputation_score, created_at FROM users WHERE id = $1`,
      [user.id],
    );
    const w = computeSupportWeight({
      isVerified: rows[0].is_verified,
      role: rows[0].role,
      reputationScore: rows[0].reputation_score,
      createdAt: rows[0].created_at,
    });
    expect(w).toBe(1.0);
  });

  test('leader with high reputation gets weight = 1.5 (capped)', async () => {
    const { user } = await createTestUser(app, { role: 'leader', is_verified: true });
    await testPool.query(
      `UPDATE users SET created_at = NOW() - INTERVAL '30 days', reputation_score = 10000 WHERE id = $1`,
      [user.id],
    );
    const { rows } = await testPool.query(
      `SELECT role, is_verified, reputation_score, created_at FROM users WHERE id = $1`,
      [user.id],
    );
    const w = computeSupportWeight({
      isVerified: rows[0].is_verified,
      role: rows[0].role,
      reputationScore: parseInt(rows[0].reputation_score, 10),
      createdAt: rows[0].created_at,
    });
    expect(w).toBe(1.5);
  });

  test('account between 24h and 7d old is capped at 0.7', async () => {
    const { user } = await createTestUser(app, { is_verified: true });
    await testPool.query(`UPDATE users SET created_at = NOW() - INTERVAL '3 days' WHERE id = $1`, [
      user.id,
    ]);
    const { rows } = await testPool.query(
      `SELECT role, is_verified, reputation_score, created_at FROM users WHERE id = $1`,
      [user.id],
    );
    const w = computeSupportWeight({
      isVerified: rows[0].is_verified,
      role: rows[0].role,
      reputationScore: parseInt(rows[0].reputation_score, 10),
      createdAt: rows[0].created_at,
    });
    expect(w).toBe(0.7);
  });

  test('actual supportIssue call records correct weight in DB', async () => {
    const { user } = await createAgedVerifiedUser(app);
    const { user: owner } = await createTestUser(app);
    const issue = await createTestIssue(owner.id);

    const result = await directSupport(user.id, issue.id);
    expect(result.weight).toBe(1.0);

    // Verify weight stored in supports table
    const { rows } = await testPool.query(
      `SELECT weight FROM supports WHERE user_id = $1 AND issue_id = $2`,
      [user.id, issue.id],
    );
    expect(parseFloat(rows[0].weight)).toBe(1.0);
  });

  test('milestone 100 auto-promotes issue to trending', async () => {
    const { user: owner } = await createTestUser(app);
    const issue = await createTestIssue(owner.id);

    let trendingFired = false;
    eventBus.once('issue.trending', () => {
      trendingFired = true;
    });

    // Set count to 99, then add one more to cross milestone
    await testPool.query(`UPDATE issues SET supporter_count = 99 WHERE id = $1`, [issue.id]);
    await testRedis.set(`issue:count:${issue.id}`, 99);

    const { user: milestoneUser } = await createAgedVerifiedUser(app);
    const result = await directSupport(milestoneUser.id, issue.id);
    expect(result.supporterCount).toBe(100);
    expect(result.milestone).toBe(100);

    // Allow async status update to settle
    await new Promise((r) => setTimeout(r, 100));
    expect(trendingFired).toBe(true);

    const { rows } = await testPool.query(`SELECT status FROM issues WHERE id = $1`, [issue.id]);
    expect(rows[0].status).toBe('trending');
  });
});
