/**
 * Request Logger Middleware
 * Adds an onResponse hook that emits one log line per request.
 * Sensitive fields are never logged.
 *
 * Dev  → coloured single line: [reqId] METHOD /path STATUS Xms user:id
 * Prod → structured JSON via pino (picked up by ELK / Loki)
 */

const SENSITIVE_KEYS = new Set(['password', 'otp', 'token', 'secret', 'authorization', 'api_key']);

const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

function statusColor(code) {
  if (code >= 500) return C.red;
  if (code >= 400) return C.yellow;
  if (code >= 300) return C.cyan;
  return C.green;
}

// Recursively redact sensitive keys from an object (for body logging if needed)
export function redactSensitive(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redactSensitive(v);
  }
  return out;
}

export function addLoggerHooks(fastify) {
  const isDev = process.env.NODE_ENV !== 'production';

  fastify.addHook('onResponse', (request, reply, done) => {
    const ms = Math.round(reply.elapsedTime);
    const status = reply.statusCode;
    const uid = request.user?.id ?? '-';
    const rid = (request.requestId ?? '').slice(0, 8);
    const slow = ms > 500;

    if (isDev) {
      const sc = statusColor(status);
      const warn = slow ? ` ${C.yellow}[SLOW]${C.reset}` : '';

      process.stdout.write(
        `${C.gray}[${rid}]${C.reset} ` +
          `${C.bold}${request.method}${C.reset} ${request.url} ` +
          `${sc}${status}${C.reset} ` +
          `${ms}ms user:${uid}${warn}\n`,
      );
    } else {
      const entry = {
        requestId: request.requestId,
        method: request.method,
        url: request.url,
        status,
        duration: ms,
        userId: uid,
        ip: request.ip,
      };
      if (slow) {
        fastify.log.warn(entry, 'Slow request');
      } else {
        fastify.log.info(entry, 'Request completed');
      }
    }

    done();
  });
}
