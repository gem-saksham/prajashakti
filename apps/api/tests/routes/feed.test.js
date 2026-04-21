/**
 * Integration tests — Feed Route
 *
 * GET /api/v1/feed
 *
 * Coverage:
 *   Default (trending) feed
 *   Mode: latest, critical, nearby
 *   Content filters: category, urgency, state, district, is_campaign
 *   Pagination: page / limit
 *   Validation: invalid mode, nearby without lat/lng, out-of-India coords
 *   Redis cache: second request is served from cache
 *   Response shape: data[], pagination{}, meta{ mode }
 *   Auth: optional — unauthenticated requests work
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

let app;
let user;
let token;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  await truncateTables();
  ({ user, token } = await createTestUser(app));
});

afterAll(async () => {
  await app.close();
  await closeTestConnections();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE = '/api/v1/feed';

async function seedIssues(overridesList) {
  return Promise.all(overridesList.map((o) => createTestIssue(user.id, o)));
}

// ── Default (trending) feed ───────────────────────────────────────────────────

describe('GET /api/v1/feed — default (trending)', () => {
  it('returns 200 with correct response shape', async () => {
    await seedIssues([
      {
        title: 'Water supply cut in eastern zone for weeks',
        urgency: 'high',
        category: 'Infrastructure',
      },
      {
        title: 'Hospital ward closed due to staff shortage',
        urgency: 'critical',
        category: 'Healthcare',
      },
    ]);

    const res = await app.inject({ method: 'GET', url: BASE });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toMatchObject({
      page: 1,
      limit: 20,
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });
    expect(body.meta).toMatchObject({ mode: 'trending' });
  });

  it('includes feedScore on each issue', async () => {
    await createTestIssue(user.id, {
      title: 'Streetlights broken on highway for three months now',
      urgency: 'medium',
    });

    const res = await app.inject({ method: 'GET', url: BASE });
    const body = res.json();

    expect(body.data.length).toBeGreaterThan(0);
    const issue = body.data[0];
    expect(typeof issue.feedScore).toBe('number');
    expect(issue.feedScore).toBeGreaterThanOrEqual(0);
  });

  it('returns issues in descending feed score order', async () => {
    // Create a critical issue (higher urgency boost) and a low-urgency issue
    await createTestIssue(user.id, {
      title: 'Critical flood warning in riverside district area',
      urgency: 'critical',
      category: 'Infrastructure',
    });
    await createTestIssue(user.id, {
      title: 'Minor footpath crack near community park area',
      urgency: 'low',
      category: 'Infrastructure',
    });

    const res = await app.inject({ method: 'GET', url: BASE });
    const body = res.json();

    expect(body.data.length).toBe(2);
    // Critical issue should have higher feedScore
    expect(body.data[0].feedScore).toBeGreaterThanOrEqual(body.data[1].feedScore);
    expect(body.data[0].urgency).toBe('critical');
  });

  it('works without authentication (optional auth)', async () => {
    await createTestIssue(user.id, { title: 'Road blocked by illegal construction for months' });

    const res = await app.inject({ method: 'GET', url: BASE }); // no Authorization header
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it('excludes closed issues', async () => {
    const issue = await createTestIssue(user.id, {
      title: 'Old issue that was already resolved last year',
    });
    await testPool.query(`UPDATE issues SET status = 'closed' WHERE id = $1`, [issue.id]);

    const res = await app.inject({ method: 'GET', url: BASE });
    const body = res.json();
    const ids = body.data.map((i) => i.id);
    expect(ids).not.toContain(issue.id);
  });
});

// ── Mode: latest ──────────────────────────────────────────────────────────────

describe('GET /api/v1/feed?mode=latest', () => {
  it('returns issues in created_at DESC order', async () => {
    // Insert two issues with different timestamps
    const older = await createTestIssue(user.id, {
      title: 'Sewage overflow near residential colony causing disease',
    });
    // Artificially make first issue older
    await testPool.query(`UPDATE issues SET created_at = NOW() - INTERVAL '1 hour' WHERE id = $1`, [
      older.id,
    ]);
    const newer = await createTestIssue(user.id, {
      title: 'Power outage in entire block for past two days',
    });

    const res = await app.inject({ method: 'GET', url: `${BASE}?mode=latest` });
    const body = res.json();

    expect(res.statusCode).toBe(200);
    expect(body.meta.mode).toBe('latest');
    // Newer issue should come first
    const ids = body.data.map((i) => i.id);
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
  });

  it('still includes feedScore on each issue', async () => {
    await createTestIssue(user.id, { title: 'Water tank contamination in sector twelve area' });

    const res = await app.inject({ method: 'GET', url: `${BASE}?mode=latest` });
    const body = res.json();
    expect(typeof body.data[0].feedScore).toBe('number');
  });
});

// ── Mode: critical ────────────────────────────────────────────────────────────

describe('GET /api/v1/feed?mode=critical', () => {
  it('returns only critical and high urgency issues', async () => {
    await seedIssues([
      {
        title: 'Hospital emergency ward shut down completely now',
        urgency: 'critical',
        category: 'Healthcare',
      },
      {
        title: 'High voltage wire fallen on main road junction',
        urgency: 'high',
        category: 'Safety',
      },
      {
        title: 'Minor pothole near side lane in colony area',
        urgency: 'medium',
        category: 'Infrastructure',
      },
      {
        title: 'Small crack on footpath near park entrance',
        urgency: 'low',
        category: 'Infrastructure',
      },
    ]);

    const res = await app.inject({ method: 'GET', url: `${BASE}?mode=critical` });
    const body = res.json();

    expect(res.statusCode).toBe(200);
    expect(body.meta.mode).toBe('critical');
    // All returned issues must be critical or high
    for (const issue of body.data) {
      expect(['critical', 'high']).toContain(issue.urgency);
    }
    expect(body.data.length).toBe(2);
  });

  it('returns 200 with empty data when no critical/high issues exist', async () => {
    await createTestIssue(user.id, {
      title: 'Low priority cosmetic issue near residential park path',
      urgency: 'low',
    });

    const res = await app.inject({ method: 'GET', url: `${BASE}?mode=critical` });
    const body = res.json();
    expect(res.statusCode).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });
});

// ── Mode: nearby ──────────────────────────────────────────────────────────────

describe('GET /api/v1/feed?mode=nearby', () => {
  it('returns issues near the given coordinates', async () => {
    // Delhi issue — close to query point
    await createTestIssue(user.id, {
      title: 'Water logging at Connaught Place causes traffic daily',
      locationLat: 28.6139,
      locationLng: 77.209,
      district: 'Central Delhi',
      state: 'Delhi',
    });
    // Chennai issue — far from Delhi query
    await createTestIssue(user.id, {
      title: 'Road damage near Marina Beach promenade walkway',
      locationLat: 13.0827,
      locationLng: 80.2707,
      district: 'Chennai',
      state: 'Tamil Nadu',
    });

    const res = await app.inject({
      method: 'GET',
      url: `${BASE}?mode=nearby&lat=28.6139&lng=77.209&radius_km=50`,
    });
    const body = res.json();

    expect(res.statusCode).toBe(200);
    expect(body.meta.mode).toBe('nearby');
    expect(body.meta.lat).toBe(28.6139);
    expect(body.meta.lng).toBe(77.209);
    // Delhi issue should be in results
    const titles = body.data.map((i) => i.title);
    expect(titles.some((t) => t.includes('Connaught'))).toBe(true);
    // Chennai issue should NOT be in results (too far)
    expect(titles.some((t) => t.includes('Marina'))).toBe(false);
  });

  it('includes distanceKm on each nearby result', async () => {
    await createTestIssue(user.id, {
      title: 'Broken street light near India Gate monument area',
      locationLat: 28.6129,
      locationLng: 77.2295,
    });

    const res = await app.inject({
      method: 'GET',
      url: `${BASE}?mode=nearby&lat=28.6139&lng=77.209&radius_km=10`,
    });
    const body = res.json();

    if (body.data.length > 0) {
      expect(typeof body.data[0].distanceKm).toBe('number');
      expect(body.data[0].distanceKm).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns 400 when lat/lng are missing for nearby mode', async () => {
    const res = await app.inject({ method: 'GET', url: `${BASE}?mode=nearby` });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('LAT_LNG_REQUIRED');
  });

  it('returns 400 for coordinates outside India', async () => {
    // London
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}?mode=nearby&lat=51.5074&lng=-0.1278`,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_LOCATION');
  });
});

// ── Content filters ───────────────────────────────────────────────────────────

describe('GET /api/v1/feed — content filters', () => {
  beforeEach(async () => {
    await seedIssues([
      {
        title: 'School roof collapsed in government building site',
        category: 'Education',
        urgency: 'critical',
        state: 'Punjab',
        district: 'Amritsar',
      },
      {
        title: 'Clinic without medicines for over three months now',
        category: 'Healthcare',
        urgency: 'high',
        state: 'Punjab',
        district: 'Ludhiana',
      },
      {
        title: 'Bridge cracking and unsafe for heavy vehicles now',
        category: 'Infrastructure',
        urgency: 'medium',
        state: 'Delhi',
        district: 'West Delhi',
      },
    ]);
  });

  it('filters by category', async () => {
    const res = await app.inject({ method: 'GET', url: `${BASE}?category=Education` });
    const body = res.json();
    expect(res.statusCode).toBe(200);
    for (const issue of body.data) {
      expect(issue.category).toBe('Education');
    }
    expect(body.data.length).toBe(1);
  });

  it('filters by urgency', async () => {
    const res = await app.inject({ method: 'GET', url: `${BASE}?urgency=critical` });
    const body = res.json();
    expect(res.statusCode).toBe(200);
    for (const issue of body.data) {
      expect(issue.urgency).toBe('critical');
    }
  });

  it('filters by state', async () => {
    const res = await app.inject({ method: 'GET', url: `${BASE}?state=Punjab` });
    const body = res.json();
    expect(res.statusCode).toBe(200);
    for (const issue of body.data) {
      expect(issue.state.toLowerCase()).toBe('punjab');
    }
    expect(body.data.length).toBe(2);
  });

  it('filters by district', async () => {
    const res = await app.inject({ method: 'GET', url: `${BASE}?state=Punjab&district=Amritsar` });
    const body = res.json();
    expect(res.statusCode).toBe(200);
    expect(body.data.length).toBe(1);
    expect(body.data[0].district.toLowerCase()).toBe('amritsar');
  });

  it('filters by is_campaign', async () => {
    const issue = await createTestIssue(user.id, {
      title: 'Campaign to fix all potholes across city streets',
    });
    await testPool.query(`UPDATE issues SET is_campaign = true WHERE id = $1`, [issue.id]);

    const res = await app.inject({ method: 'GET', url: `${BASE}?is_campaign=true` });
    const body = res.json();
    expect(res.statusCode).toBe(200);
    for (const i of body.data) {
      expect(i.isCampaign).toBe(true);
    }
    expect(body.data.some((i) => i.id === issue.id)).toBe(true);
  });
});

// ── Pagination ────────────────────────────────────────────────────────────────

describe('GET /api/v1/feed — pagination', () => {
  beforeEach(async () => {
    // Seed 6 issues
    await seedIssues(
      Array.from({ length: 6 }, (_, i) => ({
        title: `Issue number ${i + 1} affecting residents in the local area`,
        urgency: 'medium',
      })),
    );
  });

  it('respects limit param', async () => {
    const res = await app.inject({ method: 'GET', url: `${BASE}?limit=3` });
    const body = res.json();
    expect(res.statusCode).toBe(200);
    expect(body.data.length).toBe(3);
    expect(body.pagination.limit).toBe(3);
    expect(body.pagination.total).toBe(6);
    expect(body.pagination.totalPages).toBe(2);
  });

  it('respects page param', async () => {
    const page1 = await app.inject({ method: 'GET', url: `${BASE}?limit=3&page=1` });
    const page2 = await app.inject({ method: 'GET', url: `${BASE}?limit=3&page=2` });

    const ids1 = page1.json().data.map((i) => i.id);
    const ids2 = page2.json().data.map((i) => i.id);

    // Pages should not overlap
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
    // Together they cover all 6 issues
    expect(new Set([...ids1, ...ids2]).size).toBe(6);
  });

  it('returns empty data for page beyond total', async () => {
    const res = await app.inject({ method: 'GET', url: `${BASE}?page=99` });
    const body = res.json();
    expect(res.statusCode).toBe(200);
    expect(body.data).toEqual([]);
  });

  it('rejects limit > 50', async () => {
    const res = await app.inject({ method: 'GET', url: `${BASE}?limit=51` });
    expect(res.statusCode).toBe(400);
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe('GET /api/v1/feed — validation', () => {
  it('returns 400 for invalid mode', async () => {
    const res = await app.inject({ method: 'GET', url: `${BASE}?mode=viral` });
    // Fastify schema rejects unknown enum values before service layer
    expect([400, 400]).toContain(res.statusCode);
  });

  it('returns 400 for invalid category', async () => {
    const res = await app.inject({ method: 'GET', url: `${BASE}?category=InvalidCategory` });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for invalid urgency', async () => {
    const res = await app.inject({ method: 'GET', url: `${BASE}?urgency=super_critical` });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for radius_km > 100', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}?mode=nearby&lat=28.6&lng=77.2&radius_km=101`,
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── Redis cache ───────────────────────────────────────────────────────────────

describe('GET /api/v1/feed — Redis cache', () => {
  it('serves second request from cache (same ETag implied)', async () => {
    await createTestIssue(user.id, { title: 'Blocked drain causing flooding in main market road' });

    // First request: populates cache
    const res1 = await app.inject({ method: 'GET', url: BASE });
    const body1 = res1.json();
    expect(res1.statusCode).toBe(200);

    // Insert a new issue — if served from cache, it won't appear
    await createTestIssue(user.id, { title: 'New issue added after first cache population here' });

    // Second request: should hit cache, return same data as first
    const res2 = await app.inject({ method: 'GET', url: BASE });
    const body2 = res2.json();

    expect(body2.pagination.total).toBe(body1.pagination.total);
  });

  it('different modes get separate cache entries', async () => {
    await createTestIssue(user.id, {
      title: 'Critical bridge damage in central highway near town',
      urgency: 'critical',
    });
    await createTestIssue(user.id, {
      title: 'Minor paint peeling off boundary wall in colony',
      urgency: 'low',
    });

    const resTrending = await app.inject({ method: 'GET', url: `${BASE}?mode=trending` });
    const resCritical = await app.inject({ method: 'GET', url: `${BASE}?mode=critical` });

    // trending returns all non-closed, critical returns only critical/high
    expect(resTrending.json().pagination.total).toBeGreaterThan(
      resCritical.json().pagination.total,
    );
  });
});

// ── Auth: optional ────────────────────────────────────────────────────────────

describe('GET /api/v1/feed — auth is optional', () => {
  it('works with valid token', async () => {
    await createTestIssue(user.id, { title: 'Garbage not collected for past two weeks now' });
    const res = await app.inject({
      method: 'GET',
      url: BASE,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
  });

  it('works with invalid token (treated as guest)', async () => {
    await createTestIssue(user.id, { title: 'Street vendor removal causing hardship to poor' });
    const res = await app.inject({
      method: 'GET',
      url: BASE,
      headers: { Authorization: 'Bearer not-a-real-token' },
    });
    // optionalAuth should not block bad tokens — request proceeds as unauthenticated
    expect(res.statusCode).toBe(200);
  });
});
