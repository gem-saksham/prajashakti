/**
 * Request ID Middleware
 * Generates a unique UUID for every request and attaches it to:
 *   - request.requestId  (for use in handlers and logs)
 *   - X-Request-ID response header (for client tracing)
 *
 * If the client sends an X-Request-ID header, that value is reused
 * so mobile app traces can be correlated end-to-end.
 */

import { randomUUID } from 'node:crypto';

export function addRequestIdHooks(fastify) {
  fastify.decorateRequest('requestId', null);

  fastify.addHook('onRequest', (request, reply, done) => {
    const id = request.headers['x-request-id'] || randomUUID();
    request.requestId = id;
    reply.header('X-Request-ID', id);
    done();
  });
}
