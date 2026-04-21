/**
 * Support routes.
 *
 * Issue-scoped (prefix: /api/v1/issues/:id):
 *   POST   /support        [auth]    Support an issue
 *   DELETE /support        [auth]    Remove support
 *   GET    /supporters     [public]  Paginated supporters list
 *   GET    /support-stats  [public]  Count, velocity, milestone progress
 *
 * User-scoped (prefix: /api/v1/users/:userId):
 *   GET    /supported      [public]  Issues this user has supported
 */

import * as SupportService from '../services/supportService.js';
import { optionalAuth } from '../middleware/auth.js';

function sendError(reply, err) {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';
  const message = err.message ?? 'An unexpected error occurred';
  return reply.status(statusCode).send({ success: false, error: { code, message } });
}

// ── Issue-scoped support routes ───────────────────────────────────────────────

export async function issueSupportRoutes(fastify) {
  const redis = fastify.redis;

  // POST /issues/:id/support — support an issue
  fastify.post('/support', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const result = await SupportService.supportIssue(request.user.id, request.params.id, {
          redis,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          source: request.headers['x-client-platform'] || 'web',
        });
        return reply.status(201).send({ success: true, data: result });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // DELETE /issues/:id/support — remove support
  fastify.delete('/support', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const result = await SupportService.unsupportIssue(request.user.id, request.params.id, {
          redis,
        });
        return reply.send({ success: true, data: result });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // GET /issues/:id/supporters — paginated list
  fastify.get('/supporters', {
    onRequest: [optionalAuth],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const { page, limit } = request.query;
        const result = await SupportService.getSupporters(
          request.params.id,
          { page, limit },
          redis,
        );

        // If authenticated, attach hasUserSupported flag
        let hasSupported = false;
        if (request.user) {
          hasSupported = await SupportService.hasUserSupported(
            request.user.id,
            request.params.id,
            redis,
          );
        }

        return reply.send({ success: true, ...result, hasSupported });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // GET /issues/:id/support-stats — count, velocity, milestones
  fastify.get('/support-stats', {
    onRequest: [optionalAuth],
    handler: async (request, reply) => {
      try {
        const stats = await SupportService.getSupportStats(request.params.id, redis);

        let hasSupported = false;
        if (request.user) {
          hasSupported = await SupportService.hasUserSupported(
            request.user.id,
            request.params.id,
            redis,
          );
        }

        return reply.send({ success: true, data: { ...stats, hasSupported } });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });
}

// ── User-scoped supported-issues route ────────────────────────────────────────

export async function userSupportedRoutes(fastify) {
  // GET /users/:userId/supported — issues a user has supported
  fastify.get('/supported', {
    onRequest: [optionalAuth],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const { page, limit } = request.query;
        const result = await SupportService.getUserSupportedIssues(request.params.userId, {
          page,
          limit,
        });
        return reply.send({ success: true, ...result });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });
}
