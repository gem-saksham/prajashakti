/**
 * Story routes — /api/v1/issues/:issueId/stories/
 *
 * GET    /                       list stories          (optional auth)
 * POST   /                       post a story          (auth required)
 * POST   /:storyId/helpful       toggle helpful vote   (auth required)
 * DELETE /:storyId               remove story          (auth, author/admin)
 */
import { authenticate, optionalAuth } from '../middleware/auth.js';
import * as StoryService from '../services/storyService.js';
import { uuidSchema } from '../middleware/validator.js';

function sendError(reply, err) {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';
  const message = err.message ?? 'An unexpected error occurred';
  return reply.status(statusCode).send({ success: false, error: { code, message } });
}

export default async function storyRoutes(fastify) {
  // ── GET / — list stories ──────────────────────────────────────────────────
  fastify.get('/', {
    onRequest: [optionalAuth],
    schema: {
      params: { type: 'object', required: ['issueId'], properties: { issueId: uuidSchema } },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const { issueId } = request.params;
        const { page, limit } = request.query;
        const result = await StoryService.getStories(
          issueId,
          { page, limit },
          request.user?.id ?? null,
        );
        return reply.send({ success: true, ...result });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── POST / — create story ─────────────────────────────────────────────────
  fastify.post('/', {
    onRequest: [authenticate],
    schema: {
      params: { type: 'object', required: ['issueId'], properties: { issueId: uuidSchema } },
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', minLength: 10, maxLength: 1000 },
          is_anonymous: { type: 'boolean', default: false },
          photos: {
            type: 'array',
            items: {
              type: 'object',
              required: ['url'],
              properties: {
                url: { type: 'string', maxLength: 1000 },
                caption: { type: 'string', maxLength: 200 },
              },
            },
            maxItems: 3,
            default: [],
          },
        },
        additionalProperties: false,
      },
    },
    handler: async (request, reply) => {
      try {
        const { issueId } = request.params;
        const { content, is_anonymous, photos } = request.body;
        const story = await StoryService.createStory(issueId, request.user.id, {
          content,
          isAnonymous: is_anonymous || false,
          photos: photos || [],
        });
        return reply.status(201).send({ success: true, data: story });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── POST /:storyId/helpful — toggle helpful vote ──────────────────────────
  fastify.post('/:storyId/helpful', {
    onRequest: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['issueId', 'storyId'],
        properties: { issueId: uuidSchema, storyId: uuidSchema },
      },
    },
    handler: async (request, reply) => {
      try {
        const result = await StoryService.toggleHelpful(request.params.storyId, request.user.id);
        return reply.send({ success: true, data: result });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── DELETE /:storyId — remove story ──────────────────────────────────────
  fastify.delete('/:storyId', {
    onRequest: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['issueId', 'storyId'],
        properties: { issueId: uuidSchema, storyId: uuidSchema },
      },
    },
    handler: async (request, reply) => {
      try {
        const result = await StoryService.removeStory(
          request.params.storyId,
          request.user.id,
          request.user.role,
        );
        return reply.send(result);
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });
}
