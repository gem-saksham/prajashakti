/**
 * Unit tests — Token Service
 */

import { createTestApp, truncateTables, closeTestConnections, testRedis } from '../helpers.js';

import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  blacklistAccessToken,
} from '../../src/services/tokenService.js';

let app;

beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
  await closeTestConnections();
});
beforeEach(() => truncateTables());

const FAKE_USER = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  phone: '9111111111',
  role: 'citizen',
};

// ── generateAccessToken ───────────────────────────────────────────────────────

describe('generateAccessToken', () => {
  test('returns a non-empty JWT string', () => {
    const token = generateAccessToken(app, FAKE_USER);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // header.payload.sig
  });

  test('JWT payload contains id, phone, role', () => {
    const token = generateAccessToken(app, FAKE_USER);
    const decoded = app.jwt.decode(token);

    expect(decoded.id).toBe(FAKE_USER.id);
    expect(decoded.phone).toBe(FAKE_USER.phone);
    expect(decoded.role).toBe(FAKE_USER.role);
  });

  test('JWT contains iat and exp claims', () => {
    const token = generateAccessToken(app, FAKE_USER);
    const decoded = app.jwt.decode(token);

    expect(decoded.iat).toBeDefined();
    expect(decoded.exp).toBeDefined();
    expect(decoded.exp).toBeGreaterThan(decoded.iat);
  });

  test('two tokens generated seconds apart have different iat', async () => {
    const t1 = generateAccessToken(app, FAKE_USER);
    await new Promise((r) => setTimeout(r, 1100)); // ensure iat differs
    const t2 = generateAccessToken(app, FAKE_USER);

    const d1 = app.jwt.decode(t1);
    const d2 = app.jwt.decode(t2);
    expect(d2.iat).toBeGreaterThan(d1.iat);
  });
});

// ── generateRefreshToken / verifyRefreshToken ─────────────────────────────────

describe('generateRefreshToken + verifyRefreshToken', () => {
  test('generates token and stores userId + family in Redis', async () => {
    const userId = FAKE_USER.id;
    const { token, family } = await generateRefreshToken(testRedis, userId);

    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(32);
    expect(typeof family).toBe('string');

    const payload = await verifyRefreshToken(testRedis, token);
    expect(payload).not.toBeNull();
    expect(payload.userId).toBe(userId);
    expect(payload.family).toBe(family);
  });

  test('verifyRefreshToken returns null for unknown token', async () => {
    const result = await verifyRefreshToken(testRedis, 'completely-fake-token-xyz');
    expect(result).toBeNull();
  });

  test('revokeRefreshToken removes the token from Redis', async () => {
    const { token } = await generateRefreshToken(testRedis, FAKE_USER.id);
    await revokeRefreshToken(testRedis, token);

    const result = await verifyRefreshToken(testRedis, token);
    expect(result).toBeNull();
  });
});

// ── blacklistAccessToken ──────────────────────────────────────────────────────

describe('blacklistAccessToken', () => {
  test('stores blacklist entry in Redis with TTL', async () => {
    const userId = FAKE_USER.id;
    const iat = Math.floor(Date.now() / 1000) - 10;
    const exp = Math.floor(Date.now() / 1000) + 3600;

    await blacklistAccessToken(testRedis, userId, iat, exp);

    const key = `session:blacklist:${userId}:${iat}`;
    const exists = await testRedis.exists(key);
    expect(exists).toBe(1);

    const ttl = await testRedis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(3600);
  });

  test('does not store entry if token is already expired', async () => {
    const userId = FAKE_USER.id;
    const iat = Math.floor(Date.now() / 1000) - 7200;
    const exp = Math.floor(Date.now() / 1000) - 3600; // already expired

    await blacklistAccessToken(testRedis, userId, iat, exp);

    const key = `session:blacklist:${userId}:${iat}`;
    const exists = await testRedis.exists(key);
    expect(exists).toBe(0);
  });
});
