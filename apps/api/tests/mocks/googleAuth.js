/**
 * Mock helpers for Google token verification.
 * Import jest from @jest/globals — required for ESM compatibility.
 */

import { jest } from '@jest/globals';

/**
 *
 * Usage in tests:
 *   import { mockGoogleVerify } from '../mocks/googleAuth.js';
 *   import { _setFetchImpl, _resetFetch } from '../../src/services/googleAuth.js';
 *
 *   beforeEach(() => {
 *     _setFetchImpl(jest.fn().mockResolvedValue({
 *       ok: true,
 *       json: () => Promise.resolve(mockGoogleVerify({ email: 'user@gmail.com' })),
 *     }));
 *   });
 *   afterEach(() => _resetFetch());
 */

/**
 * Returns a fake Google tokeninfo API response body.
 * Mirrors the real Google tokeninfo endpoint payload shape.
 */
export function mockGoogleVerify(overrides = {}) {
  return {
    email: overrides.email ?? 'test@gmail.com',
    name: overrides.name ?? 'Test Google User',
    picture: overrides.picture ?? 'https://example.com/avatar.jpg',
    sub: overrides.sub ?? 'google_sub_123456',
    aud: overrides.aud ?? process.env.GOOGLE_CLIENT_ID ?? 'test-client-id',
    email_verified: overrides.email_verified ?? 'true',
  };
}

/**
 * Creates a mock fetch function that returns a Google tokeninfo response.
 * Pass to _setFetchImpl() before each test.
 */
export function makeMockGoogleFetch(payload = {}) {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockGoogleVerify(payload)),
  });
}

/**
 * Creates a mock fetch that simulates an invalid token response.
 */
export function makeMockGoogleFetchFail(status = 400) {
  return jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ error: 'invalid_token' }),
  });
}
