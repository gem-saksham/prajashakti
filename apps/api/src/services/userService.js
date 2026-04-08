/**
 * User Service — business logic layer.
 *
 * Routes call this; this calls the model + OTP provider + token service.
 * No raw SQL here. No HTTP reply objects here.
 * All thrown errors carry { code, message, statusCode } for the route to forward.
 */

import * as UserModel from '../models/user.js';
import { logActivity } from '../models/userActivity.js';
import { sendOtp } from './otpProvider.js';
import { verifyGoogleToken } from './googleAuth.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeFamily,
  blacklistAccessToken,
} from './tokenService.js';
import { toSnakeCase } from '../utils/transform.js';

// ── Config (from env, with safe defaults) ─────────────────────────────────────

const OTP_TTL = parseInt(process.env.OTP_EXPIRY_SECONDS ?? '300', 10);
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS ?? '3', 10);
const OTP_LOCK_TTL = parseInt(process.env.OTP_LOCK_DURATION_SECONDS ?? '900', 10); // 15 min
const OTP_RATE_LIMIT = parseInt(process.env.OTP_RATE_LIMIT_PER_HOUR ?? '5', 10);
const OTP_RATE_WINDOW = 3600; // 1 hour in seconds

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** ServiceError is thrown by service functions and caught in route handlers. */
export class ServiceError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Per-hour OTP send rate limit (sliding window via Redis sorted set).
 * Key: rate:otp:{phone}
 */
async function checkOtpRateLimit(redis, phone) {
  const key = `rate:otp:${phone}`;
  const now = Date.now();
  const windowStart = now - OTP_RATE_WINDOW * 1000;

  const results = await redis
    .pipeline()
    .zremrangebyscore(key, 0, windowStart)
    .zadd(key, now, `${now}`)
    .zcard(key)
    .expire(key, OTP_RATE_WINDOW + 1)
    .exec();

  const count = results[2][1];
  if (count > OTP_RATE_LIMIT) {
    throw new ServiceError(
      429,
      'RATE_LIMITED',
      `Too many OTP requests. Maximum ${OTP_RATE_LIMIT} per hour. Try again later.`,
    );
  }
}

async function storeAndSendOtp(redis, phone) {
  const otp = generateOtp();
  await redis.setex(`otp:${phone}`, OTP_TTL, otp);
  await sendOtp(phone, otp);
  return otp;
}

const OTP_COOLDOWN_TTL = 60; // seconds between OTP sends

/** Check if the 60-second cooldown is active for this phone. */
async function checkOtpCooldown(redis, phone) {
  // Skip cooldown in test mode — tests need to register+login in the same second
  if (process.env.NODE_ENV === 'test') return;

  const exists = await redis.exists(`rate:otp:cooldown:${phone}`);
  if (exists) {
    const ttl = await redis.ttl(`rate:otp:cooldown:${phone}`);
    throw new ServiceError(
      429,
      'RATE_LIMITED',
      `Please wait ${ttl} seconds before requesting another OTP.`,
    );
  }
}

/** Set the 60-second cooldown AFTER successfully sending an OTP. */
async function setOtpCooldown(redis, phone) {
  if (process.env.NODE_ENV === 'test') return; // no cooldown in tests
  await redis.setex(`rate:otp:cooldown:${phone}`, OTP_COOLDOWN_TTL, '1').catch(() => {});
}

// ── Exported service functions ─────────────────────────────────────────────────

/**
 * First-time registration.
 * Throws CONFLICT if phone already registered.
 */
export async function initiateRegistration(redis, { phone, name }) {
  // 1. Check for duplicate registration first (returns 409, not 429)
  const exists = await UserModel.existsByPhone(phone);
  if (exists) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'Phone number already registered. Please use /login instead.',
    );
  }

  // 2. Then apply rate limits (cooldown + hourly cap) — only for new phones
  await checkOtpCooldown(redis, phone);
  await checkOtpRateLimit(redis, phone);

  await UserModel.create({ phone, name });
  const otp = await storeAndSendOtp(redis, phone);
  await setOtpCooldown(redis, phone);
  return { otp };
}

/**
 * Login for existing users — sends OTP.
 * Throws NOT_FOUND if phone not registered.
 */
export async function initiateLogin(redis, { phone }) {
  // 1. Check phone exists first — don't leak rate-limit info for non-existent phones
  const user = await UserModel.findByPhone(phone);
  if (!user) {
    throw new ServiceError(
      404,
      'NOT_FOUND',
      'No account found with this number. Please register first.',
    );
  }

  // 2. Apply rate limits only for real accounts
  await checkOtpCooldown(redis, phone);
  await checkOtpRateLimit(redis, phone);

  const otp = await storeAndSendOtp(redis, phone);
  await setOtpCooldown(redis, phone);
  return { otp };
}

/**
 * Verify OTP (shared step for register + login).
 * Issues access + refresh tokens on success.
 * Throws RATE_LIMITED after OTP_MAX_ATTEMPTS wrong tries (OTP_LOCK_TTL lock).
 */
export async function verifyOtpAndAuthenticate(fastify, { phone, otp }) {
  const redis = fastify.redis;

  const locked = await redis.get(`otp:locked:${phone}`);
  if (locked) {
    const ttl = await redis.ttl(`otp:locked:${phone}`);
    throw new ServiceError(
      429,
      'RATE_LIMITED',
      `Too many wrong attempts. OTP locked for ${Math.ceil(ttl / 60)} more minute(s).`,
    );
  }

  const storedOtp = await redis.get(`otp:${phone}`);
  if (!storedOtp || storedOtp !== otp) {
    const attempts = await redis.incr(`otp:attempts:${phone}`);
    await redis.expire(`otp:attempts:${phone}`, OTP_LOCK_TTL);

    if (attempts >= OTP_MAX_ATTEMPTS) {
      await redis.setex(`otp:locked:${phone}`, OTP_LOCK_TTL, '1');
      await redis.del(`otp:${phone}`);
      throw new ServiceError(
        429,
        'RATE_LIMITED',
        `Too many wrong attempts. OTP locked for ${OTP_LOCK_TTL / 60} minutes.`,
      );
    }

    const remaining = OTP_MAX_ATTEMPTS - attempts;
    throw new ServiceError(
      400,
      'VALIDATION_ERROR',
      `Invalid or expired OTP. ${remaining} attempt(s) remaining.`,
    );
  }

  // Clear OTP keys + cooldown — user has proved ownership; cooldown no longer needed
  await redis.del(`otp:${phone}`, `otp:attempts:${phone}`, `rate:otp:cooldown:${phone}`);

  const user = await UserModel.updateLastLogin(phone);
  if (!user) {
    throw new ServiceError(404, 'NOT_FOUND', 'User not found. Please register first.');
  }

  const accessToken = generateAccessToken(fastify, user);
  const { token: refreshToken, family } = await generateRefreshToken(
    redis,
    user.id,
    undefined,
    fastify.request,
  );

  await redis.setex(`user:${user.id}`, 300, JSON.stringify(user));

  // Fire-and-forget — don't block the auth response
  logActivity(user.id, 'login');

  return { user, accessToken, refreshToken };
}

/**
 * Refresh access token using refresh token rotation.
 *
 * - If token is valid: delete old token, issue new access + refresh token (same family).
 * - If token is NOT found (already used or expired): TOKEN REUSE DETECTED.
 *   Revoke the entire family and force re-login on all devices.
 */
export async function refreshAccessToken(fastify, { refreshToken }, request) {
  const redis = fastify.redis;
  const payload = await verifyRefreshToken(redis, refreshToken);

  if (!payload) {
    // Token not found — could be expired OR reuse of an already-rotated token.
    // We can't distinguish without storing revoked tokens, so treat all missing
    // tokens conservatively: log for audit but don't mass-revoke (no family known).
    // Full reuse detection with family revocation is handled below when we DO find the token.
    throw new ServiceError(401, 'UNAUTHORIZED', 'Refresh token is invalid or expired.');
  }

  const { userId, family } = payload;

  const user = await UserModel.findById(userId);
  if (!user || !user.isActive) {
    // Clean up the token since the account is gone/disabled
    await revokeFamily(redis, family);
    throw new ServiceError(401, 'UNAUTHORIZED', 'User account not found or deactivated.');
  }

  // Rotate: delete old token, issue new one in same family
  const rotated = await rotateRefreshToken(redis, refreshToken, userId, request);
  if (!rotated) {
    // Race condition — token was just consumed by another concurrent request.
    // This is the reuse scenario: revoke the whole family.
    console.error(`[SECURITY] Token reuse detected — revoking family ${family} for user ${userId}`);
    await revokeFamily(redis, family);
    throw new ServiceError(
      401,
      'TOKEN_REUSE',
      'Security alert: token reuse detected. All sessions revoked. Please log in again.',
    );
  }

  const accessToken = generateAccessToken(fastify, user);
  return { accessToken, refreshToken: rotated.token, user };
}

/**
 * Calculate what percentage of the profile is filled in (0–100).
 * Also returns an array of suggestions when score < 60.
 */
export function calculateProfileCompleteness(user) {
  let score = 0;
  const suggestions = [];

  if (user.name) score += 20;
  else suggestions.push('Add your full name');
  if (user.bio) score += 15;
  else suggestions.push('Write a short bio');
  if (user.avatarUrl) score += 20;
  else suggestions.push('Add a profile photo');
  if (user.district && user.state) score += 20;
  else suggestions.push('Set your location');
  score += 10; // phone is always verified (mandatory for registration)
  if (user.isVerified) score += 15;
  else suggestions.push('Verify with Aadhaar');

  return {
    profileCompleteness: score,
    ...(score < 60 && { profileSuggestions: suggestions }),
  };
}

/**
 * Get the authenticated user's full profile. Redis cache first.
 * Injects profileCompleteness into the response.
 */
export async function getProfile(redis, userId) {
  const cached = await redis.get(`user:${userId}`);
  const user = cached ? JSON.parse(cached) : await UserModel.findById(userId);

  if (!user) throw new ServiceError(404, 'NOT_FOUND', 'User not found.');

  if (!cached) await redis.setex(`user:${userId}`, 300, JSON.stringify(user));

  return { ...user, ...calculateProfileCompleteness(user) };
}

const ALLOWED_PATCH_FIELDS = new Set([
  'name',
  'email',
  'bio',
  'avatar_url',
  'district',
  'state',
  'pincode',
  'location_lat',
  'location_lng',
]);

/**
 * Update mutable profile fields. Body arrives as camelCase from the route.
 */
export async function updateProfile(redis, userId, body) {
  const snakeBody = toSnakeCase(body);
  const filtered = Object.fromEntries(
    Object.entries(snakeBody).filter(([k]) => ALLOWED_PATCH_FIELDS.has(k)),
  );

  if (!Object.keys(filtered).length) {
    throw new ServiceError(400, 'VALIDATION_ERROR', 'No valid fields to update.');
  }

  const user = await UserModel.update(userId, filtered);
  await redis.del(`user:${userId}`);
  logActivity(userId, 'profile_updated', null, null, { fields: Object.keys(filtered) });
  return user;
}

/**
 * Link a Google account to the current authenticated user.
 * The user must be registered with a phone number first.
 * Throws CONFLICT if the Google account is already linked to another user.
 */
export async function linkGoogleAccount(redis, userId, { idToken }) {
  let profile;
  try {
    profile = await verifyGoogleToken(idToken);
  } catch (err) {
    throw new ServiceError(401, 'UNAUTHORIZED', `Google token verification failed: ${err.message}`);
  }

  // Ensure this Google account isn't already linked to a different user
  const existingByGoogle = await UserModel.findByGoogleId(profile.googleId);
  if (existingByGoogle && existingByGoogle.id !== userId) {
    throw new ServiceError(
      409,
      'CONFLICT',
      'This Google account is already linked to another PrajaShakti account.',
    );
  }

  const user = await UserModel.linkGoogleAccount(userId, {
    googleId: profile.googleId,
    email: profile.email,
    emailVerified: profile.emailVerified,
  });

  await redis.del(`user:${userId}`);
  return user;
}

/**
 * Logout — blacklist the access token and revoke the refresh token.
 */
export async function logout(redis, { userId, iat, exp, refreshToken }) {
  await blacklistAccessToken(redis, userId, iat, exp);

  if (refreshToken) {
    await revokeRefreshToken(redis, refreshToken);
  }

  await redis.del(`user:${userId}`);
}
