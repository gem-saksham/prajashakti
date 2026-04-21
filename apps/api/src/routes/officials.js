/**
 * Officials routes — /api/v1/officials/ and /api/v1/issues/:id/officials
 *
 * Public:
 *   GET  /officials               list / search
 *   GET  /officials/:id           details + stats
 *
 * Moderator-only:
 *   POST /officials               create official
 *
 * Authenticated:
 *   POST   /issues/:id/officials              tag official to issue
 *   DELETE /issues/:id/officials/:officialId  untag official
 *   GET    /issues/:id/officials              list tagged officials (public)
 *   POST   /officials/:id/claim              claim official account
 */

import * as OfficialService from '../services/officialService.js';
import { uuidSchema } from '../middleware/validator.js';

function sendError(reply, err) {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';
  const message = err.message ?? 'An unexpected error occurred';
  return reply.status(statusCode).send({ success: false, error: { code, message } });
}

// ── Standalone officials resource ─────────────────────────────────────────────

export async function officialRoutes(fastify) {
  // GET /officials — list + search
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', minLength: 2, maxLength: 100 },
          state_code: { type: 'string', minLength: 2, maxLength: 5 },
          district_code: { type: 'string', minLength: 2, maxLength: 10 },
          jurisdiction_type: {
            type: 'string',
            enum: ['national', 'state', 'district', 'municipal', 'local'],
          },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const { q, state_code, district_code, jurisdiction_type, page, limit } = request.query;

        if (q) {
          const results = await OfficialService.searchOfficials(
            q,
            {
              stateCode: state_code,
              districtCode: district_code,
            },
            limit,
          );
          return reply.send({ success: true, data: results, count: results.length });
        }

        const result = await OfficialService.listOfficials(
          {
            stateCode: state_code,
            districtCode: district_code,
            jurisdictionType: jurisdiction_type,
          },
          { page, limit },
        );
        return reply.send({ success: true, ...result });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // GET /officials/:id — single official
  fastify.get('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: uuidSchema },
      },
    },
    handler: async (request, reply) => {
      try {
        const official = await OfficialService.getOfficial(request.params.id);
        return reply.send({ success: true, data: official });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // POST /officials — create (moderator/admin only)
  fastify.post('/', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'designation'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 200 },
          designation: { type: 'string', minLength: 2, maxLength: 200 },
          department_id: uuidSchema,
          ministry_id: uuidSchema,
          jurisdiction_type: {
            type: 'string',
            enum: ['national', 'state', 'district', 'municipal', 'local'],
          },
          jurisdiction_code: { type: 'string', maxLength: 50 },
          state_code: { type: 'string', maxLength: 10 },
          district_code: { type: 'string', maxLength: 20 },
          public_email: { type: 'string', format: 'email', maxLength: 255 },
          public_phone: { type: 'string', maxLength: 20 },
          office_address: { type: 'string', maxLength: 500 },
          twitter_handle: { type: 'string', maxLength: 100 },
          cadre: { type: 'string', maxLength: 50 },
          batch_year: { type: 'integer', minimum: 1950, maximum: 2030 },
          source: { type: 'string', maxLength: 50 },
          is_verified: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
    handler: async (request, reply) => {
      try {
        const official = await OfficialService.createOfficial(request.body, request.user.role);
        return reply.status(201).send({ success: true, data: official });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // POST /officials/:id/claim — claim official account
  fastify.post('/:id/claim', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: uuidSchema },
      },
    },
    handler: async (request, reply) => {
      try {
        const result = await OfficialService.claimOfficialAccount(
          request.params.id,
          request.user.id,
        );
        return reply.status(200).send({ success: true, data: result });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });
}

// ── Issue-scoped official routes (/issues/:issueId/officials) ─────────────────

export async function issueOfficialRoutes(fastify) {
  // GET /issues/:issueId/officials — list tagged officials (public)
  fastify.get('/', {
    handler: async (request, reply) => {
      try {
        const officials = await OfficialService.getOfficialsForIssue(request.params.issueId);
        return reply.send({ success: true, data: officials, count: officials.length });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // POST /issues/:issueId/officials — tag an official
  fastify.post('/', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['official_id'],
        properties: {
          official_id: uuidSchema,
          tag_type: {
            type: 'string',
            enum: ['primary', 'escalation', 'mentioned'],
            default: 'primary',
          },
        },
        additionalProperties: false,
      },
    },
    handler: async (request, reply) => {
      try {
        const result = await OfficialService.tagOfficialToIssue(
          request.params.issueId,
          request.body.official_id,
          request.user.id,
          request.user.role,
          request.body.tag_type || 'primary',
        );
        return reply.status(201).send({ success: true, data: result });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // DELETE /issues/:issueId/officials/:officialId — untag
  fastify.delete('/:officialId', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['officialId'],
        properties: { officialId: uuidSchema },
      },
    },
    handler: async (request, reply) => {
      try {
        const result = await OfficialService.untagOfficial(
          request.params.issueId,
          request.params.officialId,
          request.user.id,
          request.user.role,
        );
        return reply.send({ success: true, ...result });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });
}
