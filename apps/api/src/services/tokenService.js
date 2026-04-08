/**
 * Token Service — access + refresh token lifecycle with rotation.
 *
 * Rotation model:
 *   - Every /refresh call invalidates the old token and issues a new pair.
 *   - Tokens are grouped into "families" (one per login session).
 *   - If a token is used after it was already rotated (reuse detected),
 *     the ENTIRE family is revoked → all devices forced to re-login.
 *   - This stops refresh token theft: if an attacker steals and uses a token
 *     that the legitimate user already used, we detect it immediately.
 *
 * Redis key schema:
 *   refresh:{tokenHash}  →  JSON { userId, family, createdAt, deviceInfo }  TTL 30d
 *   family:{family}      →  userId (used for fast family revocation)         TTL 30d
 */

import { createHash, randomBytes, randomUUID } from 'node:crypto';

// ── Config ────────────────────────────────────────────────────────────────────

const REFRESH_TTL = parseInt(process.env.JWT_REFRESH_TTL_SECONDS ?? String(30 * 24 * 60 * 60), 10);
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/** Build a device fingerprint from the request (non-PII, just for audit context). */
function deviceInfo(request) {
  if (!request) return {};
  const ip = request.ip ?? '';
  const ua = request.headers?.['user-agent'] ?? '';
  // Hash the IP so raw IP isn't stored at rest
  const ipHash = ip ? createHash('sha256').update(ip).digest('hex').slice(0, 16) : '';
  return { ipHash, ua: ua.slice(0, 200) };
}

// ── Access token ──────────────────────────────────────────────────────────────

/**
 * Sign a short-lived access JWT (15 minutes by default).
 * @param {import('fastify').FastifyInstance} fastify
 * @param {{ id: string, phone: string, role: string }} payload
 */
export function generateAccessToken(fastify, payload) {
  return fastify.jwt.sign(
    { id: payload.id, phone: payload.phone, role: payload.role },
    { expiresIn: ACCESS_EXPIRES },
  );
}

// ── Refresh token ─────────────────────────────────────────────────────────────

/**
 * Create and persist a refresh token.
 * Returns the raw token to hand back to the client (never stored raw).
 *
 * @param {import('ioredis').Redis} redis
 * @param {string} userId
 * @param {string} [family]  - supply to continue an existing family (rotation),
 *                             omit to start a new family (fresh login)
 * @param {object} [request] - Fastify request for device fingerprinting
 */
export async function generateRefreshToken(redis, userId, family, request) {
  const token = randomBytes(64).toString('hex');
  const tokenHash = hashToken(token);
  const tokenFamily = family ?? randomUUID();

  const payload = JSON.stringify({
    userId,
    family: tokenFamily,
    createdAt: Date.now(),
    device: deviceInfo(request),
  });

  // Two keys: token lookup and family→userId index (for fast revocation)
  await redis
    .pipeline()
    .setex(`refresh:${tokenHash}`, REFRESH_TTL, payload)
    .setex(`family:${tokenFamily}`, REFRESH_TTL, userId)
    .exec();

  return { token, family: tokenFamily };
}

/**
 * Verify a refresh token.
 * Returns parsed payload { userId, family, ... } or null if invalid/expired.
 */
export async function verifyRefreshToken(redis, token) {
  const key = `refresh:${hashToken(token)}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Rotate a refresh token: delete the old one, issue a new one in the same family.
 * Returns { token, family } where token is the new raw refresh token.
 */
export async function rotateRefreshToken(redis, oldToken, userId, request) {
  const payload = await verifyRefreshToken(redis, oldToken);
  if (!payload) return null;

  // Delete the consumed token
  await redis.del(`refresh:${hashToken(oldToken)}`);

  // Issue new token in the same family
  return generateRefreshToken(redis, userId, payload.family, request);
}

/**
 * Delete a single refresh token (called on logout with a specific device).
 */
export async function revokeRefreshToken(redis, token) {
  const payload = await verifyRefreshToken(redis, token);
  await redis.del(`refresh:${hashToken(token)}`);
  // Clean up family index if this was the last token in the family
  if (payload?.family) {
    await redis.del(`family:${payload.family}`);
  }
}

/**
 * Revoke an entire token family.
 * Called when reuse is detected — forces all devices that share this
 * login session to re-authenticate.
 *
 * Uses SCAN to avoid blocking the event loop.
 */
export async function revokeFamily(redis, family) {
  if (!family) return;

  // Delete the family index key
  await redis.del(`family:${family}`);

  // SCAN for all tokens in this family and delete them
  let cursor = '0';
  let revoked = 0;
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'refresh:*', 'COUNT', 100);
    cursor = nextCursor;

    if (!keys.length) continue;

    // Pipeline GET to check which ones belong to this family
    const raws = await redis.mget(...keys);
    const toDelete = [];
    for (let i = 0; i < keys.length; i++) {
      if (!raws[i]) continue;
      try {
        const p = JSON.parse(raws[i]);
        if (p.family === family) toDelete.push(keys[i]);
      } catch {
        /* skip malformed */
      }
    }
    if (toDelete.length) {
      await redis.del(...toDelete);
      revoked += toDelete.length;
    }
  } while (cursor !== '0');

  return revoked;
}

/**
 * Revoke ALL refresh tokens for a user across all families.
 * Used for logout-all-devices or after a security incident.
 * Uses SCAN to avoid blocking.
 */
export async function revokeAllUserTokens(redis, userId) {
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'refresh:*', 'COUNT', 100);
    cursor = nextCursor;
    if (!keys.length) continue;

    const raws = await redis.mget(...keys);
    const toDelete = [];
    for (let i = 0; i < keys.length; i++) {
      if (!raws[i]) continue;
      try {
        const p = JSON.parse(raws[i]);
        if (p.userId === userId) toDelete.push(keys[i]);
      } catch {
        /* skip */
      }
    }
    if (toDelete.length) await redis.del(...toDelete);
  } while (cursor !== '0');
}

/**
 * Blacklist an access token by its (userId, iat) pair until it naturally expires.
 * Called on logout alongside revokeRefreshToken.
 */
export async function blacklistAccessToken(redis, userId, iat, exp) {
  const ttl = exp - Math.floor(Date.now() / 1000);
  if (ttl > 0) {
    await redis.setex(`session:blacklist:${userId}:${iat}`, ttl, '1');
  }
}
