/**
 * Government taxonomy routes — /api/v1/government/
 *
 * All routes are public (no auth required).
 * Responses are cached in Redis for 24 hours since taxonomy data rarely changes.
 *
 * GET /ministries                      list ministries (optional ?type=central|state|ut)
 * GET /ministries/:id                  single ministry
 * GET /ministries/search               search by name (?q=)
 * GET /ministries/:id/departments      departments under a ministry
 * GET /departments/:id                 single department with ministry info
 * GET /departments/search              search departments (?q=)
 * GET /categories                      list grievance categories (optional ?praja_category=)
 * GET /categories/:slug                single category by slug
 * GET /categories/suggest              NLP keyword match (?q=)
 */

import * as GovModel from '../models/government.js';
import { ministryFilterSchema, searchSchema, uuidSchema } from '../middleware/validator.js';
import { govCacheKey } from '../utils/cacheKey.js';

const GOV_TTL = 24 * 60 * 60; // 24 hours

// ── Helper ────────────────────────────────────────────────────────────────────

function sendError(reply, err) {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';
  const message = err.message ?? 'An unexpected error occurred';
  return reply.status(statusCode).send({ success: false, error: { code, message } });
}

async function cachedQuery(redis, key, ttl, queryFn) {
  if (redis) {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);
  }
  const result = await queryFn();
  if (redis) {
    redis.setex(key, ttl, JSON.stringify(result)).catch(() => {});
  }
  return result;
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default async function governmentRoutes(fastify) {
  const redis = fastify.redis;

  // ── GET /ministries ────────────────────────────────────────────────────────
  fastify.get('/ministries', {
    schema: ministryFilterSchema,
    handler: async (request, reply) => {
      try {
        const { type } = request.query;
        const key = govCacheKey('ministries', type ?? 'all');
        const data = await cachedQuery(redis, key, GOV_TTL, () =>
          GovModel.listMinistries(type ? { type } : {}),
        );
        return reply.send({ success: true, data, count: data.length });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /ministries/search — must be before /:id ───────────────────────────
  fastify.get('/ministries/search', {
    schema: searchSchema,
    handler: async (request, reply) => {
      try {
        const data = await GovModel.searchMinistries(request.query.q);
        return reply.send({ success: true, data, count: data.length });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /ministries/:id ────────────────────────────────────────────────────
  fastify.get('/ministries/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: uuidSchema },
      },
    },
    handler: async (request, reply) => {
      try {
        const key = govCacheKey('ministry', request.params.id);
        const data = await cachedQuery(redis, key, GOV_TTL, () =>
          GovModel.getMinistryById(request.params.id),
        );
        if (!data) {
          return reply
            .status(404)
            .send({ success: false, error: { code: 'NOT_FOUND', message: 'Ministry not found' } });
        }
        return reply.send({ success: true, data });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /ministries/:id/departments ───────────────────────────────────────
  fastify.get('/ministries/:id/departments', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: uuidSchema },
      },
    },
    handler: async (request, reply) => {
      try {
        const ministryId = request.params.id;
        const key = govCacheKey('departments', 'ministry', ministryId);
        const data = await cachedQuery(redis, key, GOV_TTL, () =>
          GovModel.listDepartments(ministryId),
        );
        return reply.send({ success: true, data, count: data.length });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /departments/search — must be before /:id ─────────────────────────
  fastify.get('/departments/search', {
    schema: searchSchema,
    handler: async (request, reply) => {
      try {
        const data = await GovModel.searchDepartments(request.query.q);
        return reply.send({ success: true, data, count: data.length });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /departments/:id ───────────────────────────────────────────────────
  fastify.get('/departments/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: uuidSchema },
      },
    },
    handler: async (request, reply) => {
      try {
        const key = govCacheKey('department', request.params.id);
        const data = await cachedQuery(redis, key, GOV_TTL, () =>
          GovModel.getDepartmentById(request.params.id),
        );
        if (!data) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Department not found' },
          });
        }
        return reply.send({ success: true, data });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /categories ────────────────────────────────────────────────────────
  fastify.get('/categories', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          praja_category: { type: 'string', maxLength: 100 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const { praja_category } = request.query;
        const key = govCacheKey('categories', praja_category ?? 'all');
        const data = await cachedQuery(redis, key, GOV_TTL, () =>
          GovModel.listGrievanceCategories(praja_category),
        );
        return reply.send({ success: true, data, count: data.length });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /categories/suggest — NLP keyword match (no cache, dynamic) ────────
  fastify.get('/categories/suggest', {
    schema: {
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 3, maxLength: 500 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const data = await GovModel.findCategoryByKeywords(request.query.q);
        return reply.send({ success: true, data, count: data.length });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /categories/:slug ──────────────────────────────────────────────────
  fastify.get('/categories/:slug', {
    schema: {
      params: {
        type: 'object',
        required: ['slug'],
        properties: {
          slug: { type: 'string', pattern: '^[a-z0-9-]+$', maxLength: 100 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const key = govCacheKey('category', request.params.slug);
        const data = await cachedQuery(redis, key, GOV_TTL, () =>
          GovModel.getCategoryBySlug(request.params.slug),
        );
        if (!data) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Category not found' },
          });
        }
        return reply.send({ success: true, data });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });
}
