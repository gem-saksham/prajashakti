/**
 * Audit Service — security-relevant event logging.
 *
 * All security events are written to:
 *   1. The audit_log DB table (for long-term forensics + compliance)
 *   2. Console (critical events only — immediately visible in logs/alerts)
 *
 * Event types (by severity):
 *   info     — auth.register, auth.login_success, auth.token_refresh, auth.logout,
 *              profile.updated, profile.avatar_changed
 *   warning  — auth.login_failed, auth.otp_lockout, security.rate_limit_hit,
 *              security.invalid_token
 *   critical — auth.token_reuse_detected, security.csrf_attempt
 *
 * Non-blocking: DB writes use fire-and-forget to never delay request handling.
 * Critical events are also logged synchronously to console.
 */

import pool from '../db/postgres.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract a safe IP string (handles IPv4-mapped IPv6: ::ffff:1.2.3.4 → 1.2.3.4) */
function safeIp(ip) {
  if (!ip) return null;
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? mapped[1] : ip;
}

/** Truncate user-agent to prevent oversized inserts */
function safeUa(ua) {
  if (!ua) return null;
  return typeof ua === 'string' ? ua.slice(0, 500) : null;
}

// ── Core logger ───────────────────────────────────────────────────────────────

/**
 * Log a security/audit event.
 *
 * @param {{
 *   userId?:    string | null,
 *   eventType:  string,
 *   request?:   import('fastify').FastifyRequest | null,
 *   metadata?:  object,
 *   severity?:  'info' | 'warning' | 'critical',
 * }} params
 */
export async function logAuditEvent({
  userId = null,
  eventType,
  request = null,
  metadata = {},
  severity = 'info',
}) {
  const ip = safeIp(request?.ip ?? null);
  const ua = safeUa(request?.headers?.['user-agent'] ?? null);

  // Critical events: synchronous console output for immediate visibility
  if (severity === 'critical') {
    console.error(`[SECURITY CRITICAL] ${eventType}`, {
      userId,
      ip,
      metadata,
      ts: new Date().toISOString(),
    });
  } else if (severity === 'warning' && process.env.NODE_ENV !== 'test') {
    console.warn(`[SECURITY WARNING] ${eventType}`, { userId, ip });
  }

  // Fire-and-forget DB write — never block the caller
  pool
    .query(
      `INSERT INTO audit_log (user_id, event_type, ip_address, user_agent, metadata, severity)
     VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, eventType, ip, ua, JSON.stringify(metadata), severity],
    )
    .catch((err) => {
      // Log but never surface — audit write failure must not break auth flows
      if (process.env.NODE_ENV !== 'test') {
        console.error('[auditService] write failed (non-fatal):', err.message);
      }
    });
}

// ── Named event helpers ───────────────────────────────────────────────────────

export const audit = {
  register: (request, userId) =>
    logAuditEvent({ userId, eventType: 'auth.register', request, severity: 'info' }),
  loginSuccess: (request, userId) =>
    logAuditEvent({ userId, eventType: 'auth.login_success', request, severity: 'info' }),
  loginFailed: (request, phone) =>
    logAuditEvent({
      userId: null,
      eventType: 'auth.login_failed',
      request,
      severity: 'warning',
      metadata: { phone },
    }),
  otpLockout: (request, phone) =>
    logAuditEvent({
      userId: null,
      eventType: 'auth.otp_lockout',
      request,
      severity: 'warning',
      metadata: { phone },
    }),
  tokenRefresh: (request, userId) =>
    logAuditEvent({ userId, eventType: 'auth.token_refresh', request, severity: 'info' }),
  tokenReuseDetected: (request, userId, family) =>
    logAuditEvent({
      userId,
      eventType: 'auth.token_reuse_detected',
      request,
      severity: 'critical',
      metadata: { family },
    }),
  logout: (request, userId) =>
    logAuditEvent({ userId, eventType: 'auth.logout', request, severity: 'info' }),
  profileUpdated: (request, userId, fields) =>
    logAuditEvent({
      userId,
      eventType: 'profile.updated',
      request,
      severity: 'info',
      metadata: { fields },
    }),
  avatarChanged: (request, userId) =>
    logAuditEvent({ userId, eventType: 'profile.avatar_changed', request, severity: 'info' }),
  rateLimitHit: (request, userId, endpoint) =>
    logAuditEvent({
      userId,
      eventType: 'security.rate_limit_hit',
      request,
      severity: 'warning',
      metadata: { endpoint },
    }),
  invalidToken: (request) =>
    logAuditEvent({
      userId: null,
      eventType: 'security.invalid_token',
      request,
      severity: 'warning',
    }),
};
