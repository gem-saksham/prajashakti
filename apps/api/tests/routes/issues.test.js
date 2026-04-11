/**
 * Integration tests — Issue Routes
 *
 * Tests the full HTTP layer: auth, validation, business rules, response shape.
 * All tests hit a real Fastify instance connected to the test DB + Redis.
 *
 * Coverage:
 *   POST   /api/v1/issues              create issue
 *   GET    /api/v1/issues              list with filters
 *   GET    /api/v1/issues/stats        aggregate stats
 *   GET    /api/v1/issues/nearby       geo search
 *   GET    /api/v1/issues/me           my issues
 *   GET    /api/v1/issues/:id          single issue
 *   PATCH  /api/v1/issues/:id          update
 *   DELETE /api/v1/issues/:id          soft-delete
 */

import {
  createTestApp,
  closeTestConnections,
  truncateTables,
  createTestUser,
  createTestIssue,
  authHeader,
} from '../helpers.js';

let app;
let user1, token1;
let user2, token2;
let adminUser, adminToken;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  await truncateTables();
  ({ user: user1, token: token1 } = await createTestUser(app));
  ({ user: user2, token: token2 } = await createTestUser(app));
  ({ user: adminUser, token: adminToken } = await createTestUser(app, { role: 'admin' }));
});

afterAll(async () => {
  await app.close();
  await closeTestConnections();
});

// ── POST /issues ──────────────────────────────────────────────────────────────

describe('POST /api/v1/issues', () => {
  const validBody = {
    title: 'Broken road near main market with potholes',
    description:
      'Large potholes on the main road causing accidents and vehicle damage daily for months',
    category: 'Infrastructure',
    urgency: 'high',
    location_lat: 28.6139,
    location_lng: 77.209,
    district: 'Central Delhi',
    state: 'Delhi',
    pincode: '110001',
  };

  test('creates issue and returns 201 with nested data', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/issues',
      headers: authHeader(token1),
      payload: validBody,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id');
    expect(body.data.title).toBe(validBody.title);
    expect(body.data.category).toBe('Infrastructure');
    expect(body.data.status).toBe('active');
    expect(body.data.createdBy).toBe(user1.id);
    expect(body.data).toHaveProperty('creator');
    expect(body.data.creator.id).toBe(user1.id);
  });

  test('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/issues',
      payload: validBody,
    });
    expect(res.statusCode).toBe(401);
  });

  test('returns 400 when title is too short', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/issues',
      headers: authHeader(token1),
      payload: { ...validBody, title: 'Short' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when description is too short', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/issues',
      headers: authHeader(token1),
      payload: { ...validBody, description: 'Short desc' },
    });
    expect(res.statusCode).toBe(400);
  });

  test('returns 400 when location is outside India', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/issues',
      headers: authHeader(token1),
      payload: { ...validBody, location_lat: 51.5, location_lng: -0.12 },
    });
    expect(res.statusCode).toBe(400);
  });

  test('returns 400 for invalid ministry_id UUID', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/issues',
      headers: authHeader(token1),
      payload: { ...validBody, ministry_id: 'not-a-uuid' },
    });
    expect(res.statusCode).toBe(400);
  });

  test('returns 400 for non-existent ministry_id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/issues',
      headers: authHeader(token1),
      payload: {
        ...validBody,
        ministry_id: '00000000-0000-0000-0000-000000000000',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_MINISTRY');
  });

  test('creates anonymous issue — creator.name is "Anonymous Citizen"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/issues',
      headers: authHeader(token1),
      payload: { ...validBody, is_anonymous: true },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.creator.name).toBe('Anonymous Citizen');
    expect(res.json().data.creator.avatarUrl).toBeNull();
  });
});

// ── GET /issues ───────────────────────────────────────────────────────────────

describe('GET /api/v1/issues', () => {
  beforeEach(async () => {
    await createTestIssue(user1.id, {
      category: 'Infrastructure',
      urgency: 'high',
      district: 'South Delhi',
    });
    await createTestIssue(user1.id, {
      category: 'Healthcare',
      urgency: 'critical',
      district: 'North Delhi',
    });
    await createTestIssue(user2.id, {
      category: 'Infrastructure',
      urgency: 'medium',
      district: 'South Delhi',
    });
  });

  test('returns paginated list with success=true', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/issues' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toHaveProperty('total');
    expect(body.pagination).toHaveProperty('totalPages');
    expect(body.data.length).toBe(3);
  });

  test('filters by category', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/issues?category=Infrastructure',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.every((i) => i.category === 'Infrastructure')).toBe(true);
    expect(body.data.length).toBe(2);
  });

  test('filters by district', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/issues?district=South%20Delhi',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBe(2);
  });

  test('search by title text', async () => {
    await createTestIssue(user1.id, {
      title: 'Sewage overflow blocking drainage system near park',
      description:
        'Sewage is overflowing and blocking the drainage system, causing health hazards for residents near the park area',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/issues?search=Sewage',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(1);
  });

  test('pagination works correctly', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/issues?page=1&limit=2',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBe(2);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(2);
    expect(body.pagination.total).toBe(3);
    expect(body.pagination.totalPages).toBe(2);
  });
});

// ── GET /issues/stats ─────────────────────────────────────────────────────────

describe('GET /api/v1/issues/stats', () => {
  test('returns aggregate stats object', async () => {
    await createTestIssue(user1.id);
    await createTestIssue(user2.id, { urgency: 'critical' });

    const res = await app.inject({ method: 'GET', url: '/api/v1/issues/stats' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('total');
    expect(body.data).toHaveProperty('byStatus');
    expect(body.data).toHaveProperty('critical');
    expect(body.data).toHaveProperty('totalSupporters');
    expect(body.data).toHaveProperty('recentActivity');
    expect(body.data.total).toBeGreaterThanOrEqual(2);
    expect(body.data.critical).toBeGreaterThanOrEqual(1);
  });
});

// ── GET /issues/nearby ────────────────────────────────────────────────────────

describe('GET /api/v1/issues/nearby', () => {
  test('returns issues within radius', async () => {
    // Delhi coordinates
    await createTestIssue(user1.id, { locationLat: 28.6139, locationLng: 77.209 });
    await createTestIssue(user1.id, { locationLat: 28.62, locationLng: 77.21 });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/issues/nearby?lat=28.6139&lng=77.2090&radius_km=5',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    // Should have distanceKm
    expect(body.data[0]).toHaveProperty('distanceKm');
  });

  test('returns 400 when lat/lng missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/issues/nearby?lat=28.6',
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── GET /issues/me ────────────────────────────────────────────────────────────

describe('GET /api/v1/issues/me', () => {
  test('returns only issues created by the authenticated user', async () => {
    await createTestIssue(user1.id);
    await createTestIssue(user1.id);
    await createTestIssue(user2.id);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/issues/me',
      headers: authHeader(token1),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBe(2);
    expect(body.data.every((i) => i.createdBy === user1.id)).toBe(true);
  });

  test('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/issues/me' });
    expect(res.statusCode).toBe(401);
  });
});

// ── GET /issues/:id ───────────────────────────────────────────────────────────

describe('GET /api/v1/issues/:id', () => {
  test('returns full issue with nested objects', async () => {
    const issue = await createTestIssue(user1.id);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/issues/${issue.id}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(issue.id);
    expect(body.data).toHaveProperty('creator');
    expect(body.data).toHaveProperty('ministry');
    expect(body.data).toHaveProperty('department');
    expect(body.data).toHaveProperty('grievanceCategory');
  });

  test('returns 404 for non-existent issue', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/issues/00000000-0000-0000-0000-000000000000',
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('ISSUE_NOT_FOUND');
  });

  test('returns 400 for invalid UUID', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/issues/not-a-uuid' });
    expect(res.statusCode).toBe(400);
  });
});

// ── PATCH /issues/:id ─────────────────────────────────────────────────────────

describe('PATCH /api/v1/issues/:id', () => {
  test('owner can update title and description', async () => {
    const issue = await createTestIssue(user1.id);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/issues/${issue.id}`,
      headers: authHeader(token1),
      payload: {
        title: 'Updated road issue title with more details',
        description:
          'Updated description with more detailed information about the problem that needs fixing now',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.title).toBe('Updated road issue title with more details');
  });

  test('non-owner cannot update', async () => {
    const issue = await createTestIssue(user1.id);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/issues/${issue.id}`,
      headers: authHeader(token2),
      payload: { title: 'Trying to hijack this issue title forcefully' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  test('admin can update any issue', async () => {
    const issue = await createTestIssue(user1.id);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/issues/${issue.id}`,
      headers: authHeader(adminToken),
      payload: { urgency: 'critical' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.urgency).toBe('critical');
  });

  test('returns 400 for empty update body', async () => {
    const issue = await createTestIssue(user1.id);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/issues/${issue.id}`,
      headers: authHeader(token1),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  test('returns 401 without auth', async () => {
    const issue = await createTestIssue(user1.id);
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/issues/${issue.id}`,
      payload: { title: 'Try to update without auth token credentials' },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ── DELETE /issues/:id ────────────────────────────────────────────────────────

describe('DELETE /api/v1/issues/:id', () => {
  test('owner can soft-delete their issue', async () => {
    const issue = await createTestIssue(user1.id);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/issues/${issue.id}`,
      headers: authHeader(token1),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('closed');
  });

  test('non-owner cannot delete', async () => {
    const issue = await createTestIssue(user1.id);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/issues/${issue.id}`,
      headers: authHeader(token2),
    });
    expect(res.statusCode).toBe(403);
  });

  test('deleted issue is excluded from default list', async () => {
    const issue = await createTestIssue(user1.id);

    // Soft-delete it
    await app.inject({
      method: 'DELETE',
      url: `/api/v1/issues/${issue.id}`,
      headers: authHeader(token1),
    });

    // Default list excludes closed
    const listRes = await app.inject({ method: 'GET', url: '/api/v1/issues' });
    const ids = listRes.json().data.map((i) => i.id);
    expect(ids).not.toContain(issue.id);
  });

  test('returns 401 without auth', async () => {
    const issue = await createTestIssue(user1.id);
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/issues/${issue.id}`,
    });
    expect(res.statusCode).toBe(401);
  });
});
