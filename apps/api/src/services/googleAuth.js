/**
 * Google OAuth — token verification service.
 *
 * Flow (link-only):
 *   1. Client signs in with Google on the frontend → receives a Google ID token
 *   2. Client sends ID token to POST /api/v1/users/link/google (must be authenticated)
 *   3. We verify the token with Google's tokeninfo endpoint
 *   4. We link the verified Google account to the existing phone-registered user
 *
 * Why link-only (not standalone registration)?
 *   PrajaShakti is a civic accountability platform for Indian citizens.
 *   Phone number is the primary identity because:
 *   - It anchors the user to an Indian mobile number (ties to Aadhaar/real identity)
 *   - It prevents anonymous foreign accounts from manipulating civic issues
 *   - Google login is a UX convenience after the user is established, not a bypass
 */

// Allow overriding fetch for tests — see _setFetchImpl below
let _fetch = globalThis.fetch;

/** Inject a mock fetch implementation (tests only). */
export function _setFetchImpl(impl) {
  _fetch = impl;
}
export function _resetFetch() {
  _fetch = globalThis.fetch;
}

// ─── Core verification ────────────────────────────────────────────────────────

/**
 * Verify a Google ID token via Google's tokeninfo endpoint.
 * Returns the verified profile or throws on any failure.
 *
 * @param {string} idToken   The ID token from the Google Sign-In client
 * @returns {{ email, name, avatar, googleId, emailVerified }}
 */
export async function verifyGoogleToken(idToken) {
  const response = await _fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );

  if (!response.ok) {
    throw new Error('Invalid Google token');
  }

  const payload = await response.json();

  // Guard: token must be issued for our client ID
  const expectedAud = process.env.GOOGLE_CLIENT_ID;
  if (expectedAud && payload.aud !== expectedAud) {
    throw new Error('Token not intended for this app');
  }

  if (!payload.email) {
    throw new Error('Google account has no email address');
  }

  return {
    email: payload.email,
    name: payload.name ?? null,
    avatar: payload.picture ?? null,
    googleId: payload.sub,
    emailVerified: payload.email_verified === 'true' || payload.email_verified === true,
  };
}
