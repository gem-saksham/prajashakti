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
import { isWithinIndia } from '../utils/locationValidator.js';

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
        const issue = await IssueService.createIssue(request.user.id, request.body, redis);
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
          // Day 26 advanced filters
          min_support,
          date_range,
          has_photos,
          verified_only,
          // Geo radius
          lat,
          lng,
          radius_km,
        } = request.query;

        const filters = {};
        if (category) filters.category = category;
        if (urgency) filters.urgency = urgency;
        if (status) filters.status = status;
        if (district) filters.district = district;
        if (state) filters.state = state;
        if (is_campaign !== undefined) filters.isCampaign = is_campaign;
        if (search) filters.search = search;
        if (min_support > 0) filters.minSupport = min_support;
        if (date_range && date_range !== 'all') filters.dateRange = date_range;
        if (has_photos) filters.hasPhotos = true;
        if (verified_only) filters.verifiedOnly = true;
        if (lat != null && lng != null) {
          filters.lat = lat;
          filters.lng = lng;
          filters.radiusKm = radius_km || 10;
        }

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
        const { lat, lng, radius_km, limit, category, urgency } = request.query;
        const filters = {};
        if (category) filters.category = category;
        if (urgency) filters.urgency = urgency;
        const issues = await IssueService.getNearbyIssues(lat, lng, radius_km, limit, filters);
        return reply.send({ success: true, data: issues, count: issues.length });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /jurisdiction — Issues by state/district ──────────────────────────
  fastify.get('/jurisdiction', {
    onRequest: [optionalAuth],
    schema: {
      querystring: {
        type: 'object',
        required: ['state_code'],
        properties: {
          state_code: { type: 'string', minLength: 2, maxLength: 5 },
          district_code: { type: 'string', minLength: 2, maxLength: 10 },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          sort: {
            type: 'string',
            enum: ['newest', 'oldest', 'most_supported'],
            default: 'newest',
          },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const { state_code, district_code, page, limit, sort } = request.query;
        const result = await IssueService.getIssuesByJurisdiction(
          state_code,
          district_code || null,
          { page, limit, sort },
        );
        return reply.send({ success: true, ...result });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /bbox — Issues in bounding box ────────────────────────────────────
  fastify.get('/bbox', {
    onRequest: [optionalAuth],
    schema: {
      querystring: {
        type: 'object',
        required: ['min_lat', 'min_lng', 'max_lat', 'max_lng'],
        properties: {
          min_lat: { type: 'number', minimum: -90, maximum: 90 },
          min_lng: { type: 'number', minimum: -180, maximum: 180 },
          max_lat: { type: 'number', minimum: -90, maximum: 90 },
          max_lng: { type: 'number', minimum: -180, maximum: 180 },
          limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const { min_lat, min_lng, max_lat, max_lng, limit } = request.query;
        const issues = await IssueService.getIssuesInBoundingBox(
          min_lat,
          min_lng,
          max_lat,
          max_lng,
          limit,
        );
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

  // ── GET /:id/related — Related issues ─────────────────────────────────────
  fastify.get('/:id/related', {
    onRequest: [optionalAuth],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: uuidSchema },
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 10, default: 3 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const { limit } = request.query;
        const issues = await IssueService.getRelatedIssues(request.params.id, limit);
        return reply.send({ success: true, data: issues, count: issues.length });
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
