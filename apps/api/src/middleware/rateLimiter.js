/**
 * Redis-based sliding window rate limiters.
 * Each export is a factory that returns a Fastify preHandler hook.
 *
 * Sliding window algorithm:
 *   - Key: sorted set in Redis where each member is a unique timestamped token
 *   - On each request: remove expired members, add current, count remaining
 *
 * Limits:
 *   otpRateLimit        5  req / 1h   per phone   (hard hourly cap)
 *   otpCooldown        60s cooldown   per phone   (min gap between OTPs)
 *   failedOtpLockout    5  fails/15m  per phone   → lock 1h
 *   issueCreateLimit   10  req / 1h   per user
 *   commentLimit       30  req / 1h   per user
 *   supportLimit       60  req / 60s  per user
 *   aiLimit            10  req / 1h   per user
 *   searchLimit        30  req / 60s  per user
 */

import { createHash } from 'node:crypto';

// ─── Core sliding window ───────────────────────────────────────────────────────

async function slidingWindow(redis, key, limit, windowMs) {
  const now = Date.now();
  const windowStart = now - windowMs;
  const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const results = await redis
      .pipeline()
      .zremrangebyscore(key, 0, windowStart)
      .zadd(key, now, member)
      .zcard(key)
      .expire(key, Math.ceil(windowMs / 1000) + 1)
      .exec();

    const count = results[2][1];
    const remaining = Math.max(0, limit - count);
    const resetAt = Math.ceil((now + windowMs) / 1000);

    return { allowed: count <= limit, count, remaining, resetAt, limit };
  } catch {
    // Redis unavailable — fail open
    return { allowed: true, count: 0, remaining: limit, resetAt: 0, limit };
  }
}

function setRateLimitHeaders(reply, result) {
  reply.header('X-RateLimit-Limit', result.limit);
  reply.header('X-RateLimit-Remaining', result.remaining);
  reply.header('X-RateLimit-Reset', result.resetAt);
}

function tooManyRequests(reply, result, message) {
  const retryAfter = Math.max(1, result.resetAt - Math.floor(Date.now() / 1000));
  setRateLimitHeaders(reply, result);
  reply
    .status(429)
    .header('Retry-After', retryAfter)
    .send({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message,
        details: { retryAfterSeconds: retryAfter },
      },
    });
}

// ─── OTP rate limits ───────────────────────────────────────────────────────────

/**
 * OTP hourly cap: max 5 OTP requests per phone per hour.
 * Key: rate:otp:{phone}
 */
export function otpRateLimit(redis) {
  return async function otpRateLimitHook(request, reply) {
    const phone = request.body?.phone;
    if (!phone) return;

    const result = await slidingWindow(redis, `rate:otp:${phone}`, 5, 3_600_000);
    setRateLimitHeaders(reply, result);

    if (!result.allowed) {
      return tooManyRequests(
        reply,
        result,
        'Too many OTP requests for this number. Try again in an hour.',
      );
    }
  };
}

/**
 * OTP cooldown: minimum 60s between consecutive OTP requests.
 * Uses a simple TTL key (not a sorted set).
 */
export function otpCooldown(redis) {
  return async function otpCooldownHook(request, reply) {
    const phone = request.body?.phone;
    if (!phone) return;

    const key = `rate:otp:cooldown:${phone}`;
    const exists = await redis.exists(key).catch(() => 0);

    if (exists) {
      const ttl = await redis.ttl(key).catch(() => 60);
      reply
        .status(429)
        .header('Retry-After', ttl)
        .header('X-RateLimit-Limit', 1)
        .header('X-RateLimit-Remaining', 0)
        .header('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + ttl)
        .send({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: `Please wait ${ttl} seconds before requesting another OTP.`,
            details: { retryAfterSeconds: ttl },
          },
        });
      return;
    }

    // Set cooldown AFTER passing; the OTP send will happen after this hook
    await redis.setex(key, 60, '1').catch(() => {});
  };
}

/**
 * Failed OTP lockout: 5 failed verifications in 15 minutes → lock phone for 1 hour.
 * Call recordFailedOtp(redis, phone) on each failed verification attempt.
 * Call clearFailedOtp(redis, phone) on success.
 */
export async function checkOtpLock(redis, phone) {
  const locked = await redis.exists(`otp:locked:${phone}`).catch(() => 0);
  if (locked) {
    const ttl = await redis.ttl(`otp:locked:${phone}`).catch(() => 3600);
    return { locked: true, ttlSeconds: ttl };
  }
  return { locked: false };
}

export async function recordFailedOtp(redis, phone) {
  const key = `otp:fail:${phone}`;
  const WINDOW = 900; // 15 minutes
  const MAX = 5;

  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, WINDOW);

    if (count >= MAX) {
      await redis.setex(`otp:locked:${phone}`, 3600, '1');
      await redis.del(key);
      return { locked: true };
    }
    return { locked: false, failCount: count, remaining: MAX - count };
  } catch {
    return { locked: false, failCount: 0, remaining: MAX };
  }
}

export async function clearFailedOtp(redis, phone) {
  await redis.del(`otp:fail:${phone}`, `otp:locked:${phone}`).catch(() => {});
}

// ─── Per-IP global rate limit ──────────────────────────────────────────────────

/**
 * Global per-IP limit: 200 req/min. Applied as a Fastify global hook.
 */
export function globalIpLimit(redis) {
  return async function globalIpLimitHook(request, reply) {
    const ipHash = createHash('sha256')
      .update(request.ip ?? '')
      .digest('hex')
      .slice(0, 16);
    const result = await slidingWindow(redis, `rate:global:ip:${ipHash}`, 200, 60_000);
    setRateLimitHeaders(reply, result);
    if (!result.allowed) {
      return tooManyRequests(reply, result, 'Too many requests. Please slow down.');
    }
  };
}

// ─── Per-endpoint limiters ────────────────────────────────────────────────────

/** Issue creation — 5/hour per user (reduced from 10 per spec). */
export function issueCreateLimit(redis) {
  return async function issueCreateLimitHook(request, reply) {
    if (!request.user) return;
    const result = await slidingWindow(redis, `rate:issue:${request.user.id}`, 5, 3_600_000);
    setRateLimitHeaders(reply, result);
    if (!result.allowed) {
      return tooManyRequests(reply, result, 'Issue creation limit reached. Try again in an hour.');
    }
  };
}

/** Comments — 30/hour per user. */
export function commentLimit(redis) {
  return async function commentLimitHook(request, reply) {
    if (!request.user) return;
    const result = await slidingWindow(redis, `rate:comment:${request.user.id}`, 30, 3_600_000);
    setRateLimitHeaders(reply, result);
    if (!result.allowed) {
      return tooManyRequests(reply, result, 'Comment limit reached. Try again in an hour.');
    }
  };
}

/** Support/unsupport — 60/min per user. */
export function supportLimit(redis) {
  return async function supportLimitHook(request, reply) {
    if (!request.user) return;
    const result = await slidingWindow(redis, `rate:support:${request.user.id}`, 60, 60_000);
    setRateLimitHeaders(reply, result);
    if (!result.allowed) {
      return tooManyRequests(reply, result, 'Too many support actions. Slow down a bit!');
    }
  };
}

/** AI features — 10/hour per user. */
export function aiLimit(redis) {
  return async function aiLimitHook(request, reply) {
    if (!request.user) return;
    const result = await slidingWindow(redis, `rate:ai:${request.user.id}`, 10, 3_600_000);
    setRateLimitHeaders(reply, result);
    if (!result.allowed) {
      return tooManyRequests(reply, result, 'AI feature limit reached. Try again in an hour.');
    }
  };
}

/** Search — 30/min per user (or per IP if anonymous). */
export function searchLimit(redis) {
  return async function searchLimitHook(request, reply) {
    const key = request.user
      ? `rate:search:${request.user.id}`
      : `rate:search:ip:${createHash('sha256')
          .update(request.ip ?? '')
          .digest('hex')
          .slice(0, 16)}`;
    const result = await slidingWindow(redis, key, 30, 60_000);
    setRateLimitHeaders(reply, result);
    if (!result.allowed) {
      return tooManyRequests(reply, result, 'Search rate limit exceeded. Try again in a minute.');
    }
  };
}

/** Auth endpoints (login, register, verify-otp) — 10/min per IP. */
export function authEndpointLimit(redis) {
  return async function authEndpointLimitHook(request, reply) {
    const ipHash = createHash('sha256')
      .update(request.ip ?? '')
      .digest('hex')
      .slice(0, 16);
    const result = await slidingWindow(redis, `rate:auth:ip:${ipHash}`, 10, 60_000);
    setRateLimitHeaders(reply, result);
    if (!result.allowed) {
      return tooManyRequests(reply, result, 'Too many auth requests. Try again in a minute.');
    }
  };
}
