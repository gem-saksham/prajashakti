/**
 * Search routes — /api/v1/search/
 *
 * GET  /suggest?q=...  — autocomplete suggestions (<100 ms, Redis-cached)
 * POST /log            — record a completed search (analytics)
 * POST /click          — record a result click (CTR measurement)
 */
import { optionalAuth } from '../middleware/auth.js';
import * as SearchService from '../services/searchService.js';

export default async function searchRoutes(fastify) {
  const redis = fastify.redis;

  // ── GET /suggest ──────────────────────────────────────────────────────────
  fastify.get('/suggest', {
    onRequest: [optionalAuth],
    schema: {
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 1, maxLength: 100 },
          limit: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
        },
      },
    },
    handler: async (request, reply) => {
      const { q, limit } = request.query;
      const data = await SearchService.getSuggestions(q, { limit, redis });
      return reply.send({ success: true, ...data });
    },
  });

  // ── POST /log ─────────────────────────────────────────────────────────────
  fastify.post('/log', {
    onRequest: [optionalAuth],
    schema: {
      body: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', minLength: 1, maxLength: 500 },
          filters: { type: 'object', additionalProperties: true },
          resultCount: { type: 'integer', minimum: 0 },
          sessionId: { type: 'string', maxLength: 64 },
        },
        additionalProperties: false,
      },
    },
    handler: async (request, reply) => {
      const { query, filters, resultCount, sessionId } = request.body;
      await SearchService.logSearch({
        query,
        userId: request.user?.id,
        filters,
        resultCount,
        sessionId,
      });
      return reply.send({ success: true });
    },
  });

  // ── POST /click ───────────────────────────────────────────────────────────
  fastify.post('/click', {
    onRequest: [optionalAuth],
    schema: {
      body: {
        type: 'object',
        required: ['query', 'issueId'],
        properties: {
          query: { type: 'string', maxLength: 500 },
          issueId: { type: 'string', format: 'uuid' },
          sessionId: { type: 'string', maxLength: 64 },
        },
        additionalProperties: false,
      },
    },
    handler: async (request, reply) => {
      const { query, issueId, sessionId } = request.body;
      await SearchService.recordClick({
        query,
        userId: request.user?.id,
        sessionId,
        clickedIssueId: issueId,
      });
      return reply.send({ success: true });
    },
  });
}
