/**
 * API v1 Routes Plugin
 * All v1 routes are registered here under a single plugin so that
 * server.js only needs:
 *
 *   fastify.register(v1Routes, { prefix: '/api/v1' })
 *
 * When v2 is needed, add a v2 plugin alongside this one.
 * The /api/v1/ prefix is the only thing that changes for clients.
 */

import statusRoutes from '../routes/status.js';
import userRoutes from '../routes/users.js';
import locationRoutes from '../routes/location.js';
import mediaRoutes from '../routes/media.js';

export default async function v1Routes(fastify, _opts) {
  // ── Status / health ───────────────────────────────────────────────────────
  await fastify.register(statusRoutes);

  // ── User auth + profile ───────────────────────────────────────────────────
  await fastify.register(userRoutes, { prefix: '/users' });

  // ── Location (IP detect, reverse geocode, search) ─────────────────────────
  await fastify.register(locationRoutes, { prefix: '/location' });

  // ── Media proxy (dev only — proxies S3/LocalStack through API port) ────────
  await fastify.register(mediaRoutes, { prefix: '/media' });

  // Future routes plugged in here:
  // await fastify.register(issueRoutes,   { prefix: '/issues' });
  // await fastify.register(officialRoutes,{ prefix: '/officials' });
  // await fastify.register(debateRoutes,  { prefix: '/debates' });
}
