/**
 * Error Handler & 404 Handler
 * Registered on the root fastify instance so they catch errors from all routes.
 *
 * Standard error envelope:
 * {
 *   "success": false,
 *   "error": {
 *     "code": "VALIDATION_ERROR",
 *     "message": "Human readable string",
 *     "details": [...]   // optional, for validation errors
 *   }
 * }
 */

const STATUS_CODES = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
};

export function registerErrorHandler(fastify) {
  // ── 404 catch-all ──────────────────────────────────────────────────────────
  fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
    });
  });

  // ── Global error handler ───────────────────────────────────────────────────
  fastify.setErrorHandler((error, request, reply) => {
    const isDev = process.env.NODE_ENV !== 'production';

    // ── Fastify/Ajv schema validation errors ─────────────────────────────────
    if (error.validation) {
      const details = error.validation.map((v) => {
        const field = v.instancePath
          ? v.instancePath.replace(/^\//, '').replace(/\//g, '.')
          : (v.params?.missingProperty ?? v.params?.additionalProperty ?? 'unknown');
        return { field, message: v.message };
      });

      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details,
        },
      });
    }

    // ── PostgreSQL constraint violations ──────────────────────────────────────
    if (error.code === '23505') {
      // unique_violation — extract the field name from the detail message
      const match = error.detail?.match(/Key \((.+?)\)=/);
      return reply.status(409).send({
        success: false,
        error: {
          code: 'CONFLICT',
          message: match ? `${match[1]} already exists` : 'Record already exists',
        },
      });
    }

    if (error.code === '23503') {
      // foreign_key_violation
      return reply.status(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Referenced resource does not exist' },
      });
    }

    // ── Determine HTTP status ─────────────────────────────────────────────────
    const status = error.statusCode ?? 500;
    const code = STATUS_CODES[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');

    // Log 5xx errors server-side with full stack
    if (status >= 500) {
      fastify.log.error(
        { err: error, requestId: request.requestId, url: request.url },
        'Internal server error',
      );
    }

    return reply.status(status).send({
      success: false,
      error: {
        code,
        message: isDev || status < 500 ? error.message : 'An unexpected error occurred',
        ...(isDev && status >= 500 && { stack: error.stack }),
      },
    });
  });
}
