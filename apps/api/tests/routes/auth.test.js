/**
 * Integration tests — Auth flow (all user routes)
 * Uses fastify.inject() — no real HTTP server needed.
 */

// jest global must be imported explicitly in ESM
import { jest } from '@jest/globals';
import {
  createTestApp,
  truncateTables,
  closeTestConnections,
  testRedis,
  createTestUser,
  authHeader,
} from '../helpers.js';
import { _setFetchImpl, _resetFetch } from '../../src/services/googleAuth.js';
import { makeMockGoogleFetch, makeMockGoogleFetchFail } from '../mocks/googleAuth.js';

let app;

beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
  await closeTestConnections();
});
beforeEach(() => truncateTables());
afterEach(() => _resetFetch());

// ── Helpers ───────────────────────────────────────────────────────────────────

async function register(phone = '9200000001', name = 'Test User') {
  return app.inject({
    method: 'POST',
    url: '/api/v1/users/register',
    payload: { phone, name },
  });
}

async function login(phone) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/users/login',
    payload: { phone },
  });
}

async function verifyOtp(phone, otp) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/users/verify-otp',
    payload: { phone, otp },
  });
}

/** Register a user and complete OTP verification. Returns { user, accessToken, refreshToken }. */
async function fullRegisterAndVerify(phone = '9200000001', name = 'Test User') {
  const regRes = await register(phone, name);
  const { debug_otp } = JSON.parse(regRes.body);
  const verRes = await verifyOtp(phone, debug_otp);
  return JSON.parse(verRes.body);
}

// ── POST /register ────────────────────────────────────────────────────────────

describe('POST /api/v1/users/register', () => {
  test('valid phone+name → 200 with OTP message', async () => {
    const res = await register('9200000001', 'Arjun Sharma');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/OTP sent/i);
    expect(body.debug_otp).toMatch(/^\d{6}$/); // present in test env
  });

  test('invalid phone (5 digits) → 400 VALIDATION_ERROR', async () => {
    const res = await register('12345', 'Short Phone');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('missing name → 400 VALIDATION_ERROR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/register',
      payload: { phone: '9200000001' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe('VALIDATION_ERROR');
  });

  test('already registered phone → 409 CONFLICT', async () => {
    await register('9200000001', 'First');
    const res = await register('9200000001', 'Duplicate');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(409);
    expect(body.error.code).toBe('CONFLICT');
  });
});

// ── POST /login ───────────────────────────────────────────────────────────────

describe('POST /api/v1/users/login', () => {
  test('registered phone → 200, OTP sent', async () => {
    await fullRegisterAndVerify('9200000002');

    const res = await login('9200000002');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.debug_otp).toMatch(/^\d{6}$/);
  });

  test('unregistered phone → 404 NOT_FOUND', async () => {
    const res = await login('9299999999');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

// ── POST /verify-otp ──────────────────────────────────────────────────────────

describe('POST /api/v1/users/verify-otp', () => {
  test('correct OTP → 200, returns user + accessToken + refreshToken', async () => {
    await register('9200000003', 'Kavitha');
    const otpRes = JSON.parse((await login('9200000003')).body); // get a fresh OTP

    const res = await verifyOtp('9200000003', otpRes.debug_otp);
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.user.phone).toBe('9200000003');
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
  });

  test('wrong OTP → 400 VALIDATION_ERROR, remaining attempts shown', async () => {
    await register('9200000004');

    const res = await verifyOtp('9200000004', '000000');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toMatch(/attempt/i);
  });

  test('expired/missing OTP → 400', async () => {
    await register('9200000005');
    // Delete the OTP manually to simulate expiry
    await testRedis.del('otp:9200000005');

    const res = await verifyOtp('9200000005', '123456');
    expect(res.statusCode).toBe(400);
  });

  test('3 wrong attempts → 429 RATE_LIMITED (lockout)', async () => {
    await register('9200000006');

    await verifyOtp('9200000006', '000001');
    await verifyOtp('9200000006', '000002');
    const res = await verifyOtp('9200000006', '000003');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(429);
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.message).toMatch(/15 minutes/i);
  });

  test('after successful verify, OTP is removed from Redis', async () => {
    const { debug_otp } = JSON.parse((await register('9200000007')).body);
    await verifyOtp('9200000007', debug_otp);

    const stored = await testRedis.get('otp:9200000007');
    expect(stored).toBeNull();
  });
});

// ── GET /me ───────────────────────────────────────────────────────────────────

describe('GET /api/v1/users/me', () => {
  test('valid token → 200, full profile', async () => {
    const { token } = await createTestUser(app, { phone: '9200000010' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: authHeader(token),
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.user.phone).toBe('9200000010');
    expect(body.user.isVerified).toBeDefined(); // verified badge field present
  });

  test('no token → 401 UNAUTHORIZED', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/users/me' });
    expect(res.statusCode).toBe(401);
  });

  test('invalid token → 401 UNAUTHORIZED', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { Authorization: 'Bearer not.a.valid.jwt' },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ── PATCH /me ─────────────────────────────────────────────────────────────────

describe('PATCH /api/v1/users/me', () => {
  test('updates name and bio → 200, updated user returned', async () => {
    const { token } = await createTestUser(app, { phone: '9200000011' });

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      payload: { name: 'Updated Name', bio: 'Updated bio text' },
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.user.name).toBe('Updated Name');
    expect(body.user.bio).toBe('Updated bio text');
  });

  test('empty body (minProperties:1 violated) → 400', async () => {
    const { token } = await createTestUser(app, { phone: '9200000012' });

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── GET /:id ──────────────────────────────────────────────────────────────────

describe('GET /api/v1/users/:id', () => {
  test('returns public profile with limited fields', async () => {
    const { user } = await createTestUser(app, { phone: '9200000013' });

    const res = await app.inject({ method: 'GET', url: `/api/v1/users/${user.id}` });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.user.id).toBe(user.id);
    expect(body.user.name).toBe('Test User');
    expect(body.user.isVerified).toBeDefined(); // verified badge
    expect(body.user.phone).toBeUndefined(); // no PII
    expect(body.user.email).toBeUndefined();
    expect(body.user.locationLat).toBeUndefined();
  });

  test('nonexistent UUID → 404 NOT_FOUND', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/00000000-0000-0000-0000-000000000000',
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error.code).toBe('NOT_FOUND');
  });
});

// ── POST /refresh ─────────────────────────────────────────────────────────────

describe('POST /api/v1/users/refresh', () => {
  test('valid refresh token → 200, new access token', async () => {
    const { refreshToken } = await fullRegisterAndVerify('9200000020');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/refresh',
      payload: { refreshToken },
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.accessToken).toBeDefined();
    expect(body.user).toBeDefined();
  });

  test('invalid refresh token → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/refresh',
      payload: { refreshToken: 'fake-refresh-token-that-does-not-exist' },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error.code).toBe('UNAUTHORIZED');
  });
});

// ── POST /logout ──────────────────────────────────────────────────────────────

describe('POST /api/v1/users/logout', () => {
  test('logout blacklists access token', async () => {
    const { accessToken, refreshToken } = await fullRegisterAndVerify('9200000030');

    // Logout
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/users/logout',
      headers: { ...authHeader(accessToken), 'Content-Type': 'application/json' },
      payload: { refreshToken },
    });
    expect(logoutRes.statusCode).toBe(200);

    // Access token is now blacklisted
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: authHeader(accessToken),
    });
    expect(meRes.statusCode).toBe(401);
    expect(JSON.parse(meRes.body).error.message).toMatch(/invalidated/i);
  });

  test('refresh token revoked after logout', async () => {
    const { accessToken, refreshToken } = await fullRegisterAndVerify('9200000031');

    await app.inject({
      method: 'POST',
      url: '/api/v1/users/logout',
      headers: { ...authHeader(accessToken), 'Content-Type': 'application/json' },
      payload: { refreshToken },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/refresh',
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

describe('OTP rate limiting', () => {
  test('6th OTP request within an hour → 429 RATE_LIMITED', async () => {
    // Register a user first so /login works
    await fullRegisterAndVerify('9200000040');

    // 5 allowed requests
    for (let i = 0; i < 5; i++) {
      await login('9200000040');
    }

    // 6th request should be rate-limited
    const res = await login('9200000040');
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(429);
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.message).toMatch(/per hour/i);
  });
});

// ── POST /link/google ─────────────────────────────────────────────────────────

describe('POST /api/v1/users/link/google', () => {
  test('authenticated user links Google account → 200, user has googleId', async () => {
    const { token } = await createTestUser(app, { phone: '9200000050' });

    _setFetchImpl(makeMockGoogleFetch({ email: 'test50@gmail.com', sub: 'gsub_50' }));

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/link/google',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      payload: { idToken: 'fake_google_id_token' },
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.user).toBeDefined();
  });

  test('no auth → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/link/google',
      payload: { idToken: 'fake' },
    });
    expect(res.statusCode).toBe(401);
  });

  test('invalid Google token → 401 UNAUTHORIZED', async () => {
    const { token } = await createTestUser(app, { phone: '9200000051' });

    _setFetchImpl(makeMockGoogleFetchFail());

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/link/google',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      payload: { idToken: 'bad_token' },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error.code).toBe('UNAUTHORIZED');
  });

  test('Google account already linked to another user → 409 CONFLICT', async () => {
    const { token: token1 } = await createTestUser(app, { phone: '9200000052' });
    const { token: token2 } = await createTestUser(app, { phone: '9200000053' });

    // Link google account to user 1
    _setFetchImpl(makeMockGoogleFetch({ sub: 'shared_google_id', email: 'shared@gmail.com' }));
    await app.inject({
      method: 'POST',
      url: '/api/v1/users/link/google',
      headers: { ...authHeader(token1), 'Content-Type': 'application/json' },
      payload: { idToken: 'token_1' },
    });

    // Try to link same google account to user 2 → CONFLICT
    _setFetchImpl(makeMockGoogleFetch({ sub: 'shared_google_id', email: 'shared@gmail.com' }));
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/link/google',
      headers: { ...authHeader(token2), 'Content-Type': 'application/json' },
      payload: { idToken: 'token_2' },
    });

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error.code).toBe('CONFLICT');
  });
});

// ── POST /verify-aadhaar ──────────────────────────────────────────────────────

describe('POST /api/v1/users/verify-aadhaar', () => {
  test('authenticated user in dev → 200, is_verified set to true', async () => {
    const { user, token } = await createTestUser(app, { phone: '9200000060' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/verify-aadhaar',
      headers: authHeader(token),
    });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.status).toBe('verified');
    // aadhaarService returns a raw DB row (snake_case) as the user field
    expect(body.user?.is_verified ?? body.user?.isVerified).toBe(true);
  });

  test('no auth → 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/users/verify-aadhaar' });
    expect(res.statusCode).toBe(401);
  });
});
