/**
 * Issue routes — /api/v1/issues/
 *
 * POST   /               create issue            (auth required)
 * GET    /               list issues             (optional auth)
 * GET    /stats          aggregate stats         (public)
 * GET    /nearby         geo search              (optional auth)
 * GET    /me             my issues               (auth required)
 * GET    /:id            single issue            (optional auth)
 * PATCH  /:id            update issue            (auth, owner only)
 * DELETE /:id            soft-delete             (auth, owner only)
 */

import { authenticate, optionalAuth } from '../middleware/auth.js';
import {
  issueCreateSchema,
  issueUpdateSchema,
  issueFilterSchema,
  issueNearbySchema,
  uuidSchema,
} from '../middleware/validator.js';
import * as IssueService from '../services/issueService.js';

// ── Helper ────────────────────────────────────────────────────────────────────

function sendError(reply, err) {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';
  const message = err.message ?? 'An unexpected error occurred';
  return reply.status(statusCode).send({ success: false, error: { code, message } });
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default async function issueRoutes(fastify) {
  const redis = fastify.redis;

  // ── POST / — Create issue ──────────────────────────────────────────────────
  fastify.post('/', {
    onRequest: [authenticate],
    schema: issueCreateSchema,
    handler: async (request, reply) => {
      try {
        const issue = await IssueService.createIssue(request.user.id, request.body);
        return reply.status(201).send({ success: true, data: issue });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET / — List issues ────────────────────────────────────────────────────
  fastify.get('/', {
    onRequest: [optionalAuth],
    schema: issueFilterSchema,
    handler: async (request, reply) => {
      try {
        const {
          page,
          limit,
          sort,
          category,
          urgency,
          status,
          district,
          state,
          is_campaign,
          search,
        } = request.query;

        const filters = {};
        if (category) filters.category = category;
        if (urgency) filters.urgency = urgency;
        if (status) filters.status = status;
        if (district) filters.district = district;
        if (state) filters.state = state;
        if (is_campaign !== undefined) filters.isCampaign = is_campaign;
        if (search) filters.search = search;

        const result = await IssueService.listIssues(filters, { page, limit, sort }, redis);
        return reply.send({ success: true, ...result });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /stats — Aggregate stats ───────────────────────────────────────────
  fastify.get('/stats', {
    handler: async (request, reply) => {
      try {
        const stats = await IssueService.getIssueStats(redis);
        return reply.send({ success: true, data: stats });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /nearby — Geo search ───────────────────────────────────────────────
  fastify.get('/nearby', {
    onRequest: [optionalAuth],
    schema: issueNearbySchema,
    handler: async (request, reply) => {
      try {
        const { lat, lng, radius_km, limit } = request.query;
        const issues = await IssueService.getNearbyIssues(lat, lng, radius_km, limit);
        return reply.send({ success: true, data: issues, count: issues.length });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /me — My issues ────────────────────────────────────────────────────
  fastify.get('/me', {
    onRequest: [authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          sort: {
            type: 'string',
            enum: ['newest', 'oldest', 'most_supported', 'most_urgent', 'most_viewed'],
            default: 'newest',
          },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const { page, limit, sort } = request.query;
        const result = await IssueService.getMyIssues(request.user.id, { page, limit, sort });
        return reply.send({ success: true, ...result });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /:id — Single issue ────────────────────────────────────────────────
  fastify.get('/:id', {
    onRequest: [optionalAuth],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: uuidSchema },
      },
    },
    handler: async (request, reply) => {
      try {
        const viewerId = request.user?.id ?? null;
        const issue = await IssueService.getIssue(request.params.id, viewerId, redis);
        return reply.send({ success: true, data: issue });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── PATCH /:id — Update issue ──────────────────────────────────────────────
  fastify.patch('/:id', {
    onRequest: [authenticate],
    schema: issueUpdateSchema,
    handler: async (request, reply) => {
      try {
        const issue = await IssueService.updateIssue(
          request.params.id,
          request.user.id,
          request.user.role,
          request.body,
          redis,
        );
        return reply.send({ success: true, data: issue });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── DELETE /:id — Soft-delete issue ───────────────────────────────────────
  fastify.delete('/:id', {
    onRequest: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: uuidSchema },
      },
    },
    handler: async (request, reply) => {
      try {
        const result = await IssueService.deleteIssue(
          request.params.id,
          request.user.id,
          request.user.role,
          redis,
        );
        return reply.send({ success: true, data: result });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });
}
