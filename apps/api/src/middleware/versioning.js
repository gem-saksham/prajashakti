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
import issueRoutes from '../routes/issues.js';
import governmentRoutes from '../routes/government.js';
import photoRoutes from '../routes/photos.js';
import { officialRoutes, issueOfficialRoutes } from '../routes/officials.js';
import tagSuggestionRoutes from '../routes/tagSuggestion.js';
import { issueSupportRoutes, userSupportedRoutes } from '../routes/supports.js';
import feedRoutes from '../routes/feed.js';
import aiRoutes from '../routes/ai.js';
import searchRoutes from '../routes/search.js';
import storyRoutes from '../routes/stories.js';

export default async function v1Routes(fastify, _opts) {
  // ── Status / health ───────────────────────────────────────────────────────
  await fastify.register(statusRoutes);

  // ── User auth + profile ───────────────────────────────────────────────────
  await fastify.register(userRoutes, { prefix: '/users' });

  // ── Location (IP detect, reverse geocode, search) ─────────────────────────
  await fastify.register(locationRoutes, { prefix: '/location' });

  // ── Media proxy (dev only — proxies S3/LocalStack through API port) ────────
  await fastify.register(mediaRoutes, { prefix: '/media' });

  // ── Issues (Sprint 2) ─────────────────────────────────────────────────────
  await fastify.register(issueRoutes, { prefix: '/issues' });

  // ── Tag suggestion (nested under /issues prefix) ──────────────────────────
  await fastify.register(tagSuggestionRoutes, { prefix: '/issues' });

  // ── Issue photo uploads (Sprint 2) ────────────────────────────────────────
  await fastify.register(photoRoutes, { prefix: '/issues/:issueId/photos' });

  // ── Issue-scoped official tagging ─────────────────────────────────────────
  await fastify.register(issueOfficialRoutes, { prefix: '/issues/:issueId/officials' });

  // ── Government taxonomy (Sprint 2) ───────────────────────────────────────
  await fastify.register(governmentRoutes, { prefix: '/government' });

  // ── Officials (Day 20) ────────────────────────────────────────────────────
  await fastify.register(officialRoutes, { prefix: '/officials' });

  // ── Support system (Day 21) ───────────────────────────────────────────────
  await fastify.register(issueSupportRoutes, { prefix: '/issues/:id' });
  await fastify.register(userSupportedRoutes, { prefix: '/users/:userId' });

  // ── Ranked feed (Day 23 / Sprint 3) ──────────────────────────────────────
  await fastify.register(feedRoutes, { prefix: '/feed' });

  // ── AI features (proxy to Anthropic) ─────────────────────────────────────
  await fastify.register(aiRoutes, { prefix: '/ai' });

  // ── Search & autocomplete (Day 26) ────────────────────────────────────────
  await fastify.register(searchRoutes, { prefix: '/search' });

  // ── Ground-reality stories (Day 27) ──────────────────────────────────────
  await fastify.register(storyRoutes, { prefix: '/issues/:issueId/stories' });
}
