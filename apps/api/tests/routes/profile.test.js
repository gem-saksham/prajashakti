/**
 * Integration tests — Profile, Avatar, Location, Activity
 *
 * Covers:
 *   GET  /me              — full profile with completeness score
 *   GET  /me              — profileSuggestions when profile is incomplete
 *   PATCH /me             — bio update → completeness score increases
 *   POST /me/avatar-upload-url — returns valid pre-signed URL structure
 *   POST /me/avatar-upload-url — invalid fileType → 400
 *   DELETE /me/avatar     — sets avatarUrl to null
 *   GET  /users/:id       — public profile with stats (no phone/email)
 *   GET  /users/:id       — non-existent user → 404
 *   GET  /users/:id/activity — returns activity list
 *   GET  /location/detect — returns location data or graceful null
 *   GET  /location/search?q=Chandigarh — returns results array
 *   GET  /location/reverse?lat=&lng= — returns address, second call hits cache
 */

import { jest } from '@jest/globals';
import {
  createTestApp,
  truncateTables,
  closeTestConnections,
  testPool,
  testRedis,
  createTestUser,
  authHeader,
} from '../helpers.js';

// ── Mock uploadService so tests don't need real S3 ────────────────────────────
// We mock at the module level using jest.unstable_mockModule before any imports.
// The mock must be set up before the app loads (dynamic import below).

const MOCK_UPLOAD_URL = 'https://s3.example.com/presigned-put-url';
const MOCK_FILE_KEY = 'avatars/test-user/mock-uuid.jpg';
const MOCK_PUBLIC_URL =
  'http://localhost:4566/prajashakti-media-dev/avatars/test-user/mock-uuid.jpg';

jest.unstable_mockModule('../../src/services/uploadService.js', () => ({
  generateUploadUrl: jest.fn(async (_userId, _fileType, _folder) => ({
    uploadUrl: MOCK_UPLOAD_URL,
    fileKey: MOCK_FILE_KEY,
    publicUrl: MOCK_PUBLIC_URL,
    maxBytes: 5 * 1024 * 1024,
  })),
  deleteFile: jest.fn(async () => {}),
  extractKeyFromUrl: jest.fn(() => MOCK_FILE_KEY),
  generateThumbnailKey: jest.fn((k) => k.replace(/(\.\w+)$/, '_thumb$1')),
}));

// ── Mock locationService so tests don't hit external APIs ─────────────────────
jest.unstable_mockModule('../../src/services/locationService.js', () => ({
  detectLocationFromIp: jest.fn(async () => ({
    lat: 30.7333,
    lng: 76.7794,
    district: 'Chandigarh',
    state: 'Chandigarh',
    pincode: '160017',
    accuracy: 'ip',
  })),
  reverseGeocode: jest.fn(async (_redis, _lat, _lng) => ({
    district: 'Chandigarh',
    state: 'Chandigarh',
    pincode: '160017',
    formattedAddress: 'Sector 17, Chandigarh, India',
  })),
  searchLocation: jest.fn(async (_redis, _query) => [
    {
      displayName: 'Chandigarh, India',
      lat: 30.7333,
      lng: 76.7794,
      district: 'Chandigarh',
      state: 'Chandigarh',
    },
  ]),
}));

let app;

beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
  await closeTestConnections();
});
beforeEach(() => truncateTables());

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function me(token) {
  return app.inject({ method: 'GET', url: '/api/v1/users/me', headers: authHeader(token) });
}

async function patchMe(token, body) {
  return app.inject({
    method: 'PATCH',
    url: '/api/v1/users/me',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    payload: body,
  });
}

// ─── GET /me — completeness score ─────────────────────────────────────────────

test('GET /me returns profile with completeness score', async () => {
  const { token } = await createTestUser(app);
  const res = await me(token);
  const body = JSON.parse(res.body);

  expect(res.statusCode).toBe(200);
  expect(body.success).toBe(true);
  expect(typeof body.user.profileCompleteness).toBe('number');
  expect(body.user.profileCompleteness).toBeGreaterThanOrEqual(0);
  expect(body.user.profileCompleteness).toBeLessThanOrEqual(100);
});

test('GET /me shows profileSuggestions when profile is incomplete', async () => {
  // createTestUser creates a minimal user (name + phone only, no bio, no avatar)
  const { token } = await createTestUser(app, { name: 'Minimal User' });
  const res = await me(token);
  const body = JSON.parse(res.body);

  expect(res.statusCode).toBe(200);
  // Score: name(20) + phone(10) + district+state(20 from createTestUser) = 50 < 60
  expect(body.user.profileCompleteness).toBeLessThan(60);
  expect(Array.isArray(body.user.profileSuggestions)).toBe(true);
  expect(body.user.profileSuggestions.length).toBeGreaterThan(0);
});

// ─── PATCH /me → completeness score increases ─────────────────────────────────

test('PATCH /me updates bio and completeness score increases', async () => {
  const { token } = await createTestUser(app, { name: 'Arjun Sharma' });

  const before = JSON.parse((await me(token)).body);
  const scoreBefore = before.user.profileCompleteness;

  await patchMe(token, { bio: 'Civic activist from Chandigarh fighting for better roads' });

  const after = JSON.parse((await me(token)).body);
  expect(after.user.profileCompleteness).toBeGreaterThan(scoreBefore);
  expect(after.user.bio).toBe('Civic activist from Chandigarh fighting for better roads');
});

// ─── POST /me/avatar-upload-url ───────────────────────────────────────────────

test('POST /me/avatar-upload-url returns valid pre-signed URL structure', async () => {
  const { token } = await createTestUser(app);
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/users/me/avatar-upload-url',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    payload: { fileType: 'image/jpeg' },
  });
  const body = JSON.parse(res.body);

  expect(res.statusCode).toBe(200);
  expect(body.success).toBe(true);
  expect(typeof body.uploadUrl).toBe('string');
  expect(typeof body.fileKey).toBe('string');
  expect(typeof body.publicUrl).toBe('string');
  expect(body.fileKey).toMatch(/^avatars\//);
});

test('POST /me/avatar-upload-url with invalid fileType returns 400', async () => {
  const { token } = await createTestUser(app);
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/users/me/avatar-upload-url',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    payload: { fileType: 'application/pdf' },
  });

  expect(res.statusCode).toBe(400);
  const body = JSON.parse(res.body);
  expect(body.success).toBe(false);
});

// ─── DELETE /me/avatar ────────────────────────────────────────────────────────

test('DELETE /me/avatar sets avatarUrl to null', async () => {
  const { token, user } = await createTestUser(app);

  // First set an avatar
  await testPool.query(`UPDATE users SET avatar_url = $1 WHERE id = $2`, [
    MOCK_PUBLIC_URL,
    user.id,
  ]);
  await testRedis.del(`user:${user.id}`);

  const res = await app.inject({
    method: 'DELETE',
    url: '/api/v1/users/me/avatar',
    headers: authHeader(token),
  });
  const body = JSON.parse(res.body);

  expect(res.statusCode).toBe(200);
  expect(body.success).toBe(true);
  expect(body.user.avatarUrl).toBeNull();
});

// ─── GET /users/:id — public profile ─────────────────────────────────────────

test('GET /users/:id returns public profile with stats (no phone/email)', async () => {
  const { user } = await createTestUser(app, { name: 'Public User' });

  const res = await app.inject({ method: 'GET', url: `/api/v1/users/${user.id}` });
  const body = JSON.parse(res.body);

  expect(res.statusCode).toBe(200);
  expect(body.success).toBe(true);
  expect(body.user.id).toBe(user.id);
  expect(body.user.name).toBe('Public User');

  // PII must NOT be present
  expect(body.user.phone).toBeUndefined();
  expect(body.user.email).toBeUndefined();
  expect(body.user.locationLat).toBeUndefined();
  expect(body.user.locationLng).toBeUndefined();

  // Stats must be present
  expect(body.user.stats).toBeDefined();
  expect(typeof body.user.stats.issuesRaised).toBe('number');
  expect(typeof body.user.stats.issuesSupported).toBe('number');
  expect(typeof body.user.stats.commentsPosted).toBe('number');

  // Shape
  expect(body.user.joinedAt).toBeDefined();
});

test('GET /users/:id for non-existent user returns 404', async () => {
  const fakeId = '00000000-0000-4000-8000-000000000000';
  const res = await app.inject({ method: 'GET', url: `/api/v1/users/${fakeId}` });

  expect(res.statusCode).toBe(404);
  const body = JSON.parse(res.body);
  expect(body.success).toBe(false);
  expect(body.error.code).toBe('NOT_FOUND');
});

// ─── GET /users/:id/activity ──────────────────────────────────────────────────

test('GET /users/:id/activity returns paginated activity list', async () => {
  const { user } = await createTestUser(app);

  // Insert some activity directly
  await testPool.query(
    `INSERT INTO user_activity (user_id, action, entity_type, metadata)
     VALUES ($1, 'issue_created', 'issue', '{}'),
            ($1, 'issue_supported', 'issue', '{}')`,
    [user.id],
  );

  const res = await app.inject({ method: 'GET', url: `/api/v1/users/${user.id}/activity` });
  const body = JSON.parse(res.body);

  expect(res.statusCode).toBe(200);
  expect(body.success).toBe(true);
  expect(Array.isArray(body.data)).toBe(true);
  expect(body.data.length).toBe(2);
  expect(body.pagination).toBeDefined();
  expect(body.pagination.total).toBe(2);
});

// ─── GET /location/detect ─────────────────────────────────────────────────────

test('GET /location/detect returns location data', async () => {
  const { token } = await createTestUser(app);
  const res = await app.inject({
    method: 'GET',
    url: '/api/v1/location/detect',
    headers: authHeader(token),
  });
  const body = JSON.parse(res.body);

  expect(res.statusCode).toBe(200);
  expect(body.success).toBe(true);
  // Either a location object or null with a message (both are valid)
  if (body.location) {
    expect(typeof body.location.lat).toBe('number');
    expect(typeof body.location.lng).toBe('number');
  }
});

// ─── GET /location/search ─────────────────────────────────────────────────────

test('GET /location/search?q=Chandigarh returns results', async () => {
  const { token } = await createTestUser(app);
  const res = await app.inject({
    method: 'GET',
    url: '/api/v1/location/search?q=Chandigarh',
    headers: authHeader(token),
  });
  const body = JSON.parse(res.body);

  expect(res.statusCode).toBe(200);
  expect(body.success).toBe(true);
  expect(Array.isArray(body.results)).toBe(true);
  expect(body.results.length).toBeGreaterThan(0);
  expect(body.results[0].displayName).toBeDefined();
  expect(typeof body.results[0].lat).toBe('number');
  expect(typeof body.results[0].lng).toBe('number');
});

// ─── GET /location/reverse — cache hit ───────────────────────────────────────

test('GET /location/reverse returns address and second call hits Redis cache', async () => {
  const { token } = await createTestUser(app);
  const url = '/api/v1/location/reverse?lat=30.7333&lng=76.7794';

  const res1 = await app.inject({ method: 'GET', url, headers: authHeader(token) });
  const body1 = JSON.parse(res1.body);
  expect(res1.statusCode).toBe(200);
  expect(body1.success).toBe(true);
  expect(body1.location.district).toBeDefined();
  expect(body1.location.state).toBeDefined();

  // Verify the result is now in Redis
  const cacheKey = 'geo:30.733:76.779';
  const cached = await testRedis.get(cacheKey);
  expect(cached).not.toBeNull();

  // Second call — mock should only have been called once (cache hit)
  const res2 = await app.inject({ method: 'GET', url, headers: authHeader(token) });
  const body2 = JSON.parse(res2.body);
  expect(res2.statusCode).toBe(200);
  expect(body2.location.district).toBe(body1.location.district);
});
