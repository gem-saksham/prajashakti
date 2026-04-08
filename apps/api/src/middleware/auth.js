/**
 * Auth Middleware
 * Pure hook functions — no factory needed because @fastify/jwt attaches
 * jwtVerify() directly onto every request object.
 */

const VERIFIED_ROLES = new Set(['verified_citizen', 'leader', 'moderator', 'official', 'admin']);

// ─── authenticate ─────────────────────────────────────────────────────────────
// Verifies JWT from Authorization: Bearer header.
// Attaches request.user = { id, phone, role } on success.
// Also checks the Redis logout blacklist — tokens invalidated via POST /logout
// are rejected even before their natural expiry.
export async function authenticate(request, reply) {
  try {
    await request.jwtVerify();

    // Check if this token was explicitly invalidated (logout)
    const { id, iat } = request.user;
    const blacklisted = await request.server.redis?.exists(`session:blacklist:${id}:${iat}`);
    if (blacklisted) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Token has been invalidated. Please login again.' },
      });
    }
  } catch (err) {
    const expired = err.message?.toLowerCase().includes('expired');
    return reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: expired ? 'Token expired, please login again' : 'Invalid or missing token',
      },
    });
  }
}

// ─── optionalAuth ─────────────────────────────────────────────────────────────
// Same as authenticate but silently clears request.user on any failure,
// including blacklisted (logged-out) tokens.
export async function optionalAuth(request) {
  try {
    await request.jwtVerify();
    const { id, iat } = request.user;
    const blacklisted = await request.server.redis?.exists(`session:blacklist:${id}:${iat}`);
    if (blacklisted) request.user = null;
  } catch {
    request.user = null;
  }
}

// ─── requireRole ─────────────────────────────────────────────────────────────
// Factory — returns a preHandler hook that checks role membership.
// Usage: preHandler: [authenticate, requireRole('admin', 'moderator')]
export function requireRole(...roles) {
  const allowed = new Set(roles);
  return async function checkRole(request, reply) {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }
    if (!allowed.has(request.user.role)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Required role: ${roles.join(' or ')}`,
        },
      });
    }
  };
}

// ─── requireVerified ─────────────────────────────────────────────────────────
// Ensures the user is at least 'verified_citizen'.
export async function requireVerified(request, reply) {
  if (!request.user || !VERIFIED_ROLES.has(request.user.role)) {
    return reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Please verify your account' },
    });
  }
}
