/**
 * Feed routes — /api/v1/feed
 *
 * GET /    Ranked issue feed (trending|nearby|latest|critical)
 *
 * Optional auth: authenticated users get the same feed; personalisation
 * (e.g. filter out already-supported issues) is a Phase 2 Sprint 3 feature.
 */

import { optionalAuth } from '../middleware/auth.js';
import { feedQuerySchema } from '../middleware/validator.js';
import * as FeedService from '../services/feedService.js';

function sendError(reply, err) {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';
  const message = err.message ?? 'An unexpected error occurred';
  return reply.status(statusCode).send({ success: false, error: { code, message } });
}

export default async function feedRoutes(fastify) {
  const redis = fastify.redis;

  /**
   * GET /api/v1/feed
   *
   * Query params:
   *   mode        trending|nearby|latest|critical  (default: trending)
   *   lat         number  — required for nearby
   *   lng         number  — required for nearby
   *   radius_km   number  — default 20, max 100
   *   category    enum
   *   urgency     enum
   *   state       string
   *   district    string
   *   is_campaign boolean
   *   page        integer — default 1
   *   limit       integer — default 20, max 50
   *
   * Response: { success, data: Issue[], pagination, meta: { mode, ... } }
   */
  fastify.get('/', {
    onRequest: [optionalAuth],
    schema: feedQuerySchema,
    handler: async (request, reply) => {
      try {
        const {
          mode,
          lat,
          lng,
          radius_km,
          category,
          urgency,
          state,
          district,
          is_campaign,
          page,
          limit,
        } = request.query;

        const filters = {};
        if (category) filters.category = category;
        if (urgency) filters.urgency = urgency;
        if (state) filters.state = state;
        if (district) filters.district = district;
        if (is_campaign !== undefined) filters.isCampaign = is_campaign;

        const result = await FeedService.getFeed(
          {
            mode,
            filters,
            lat,
            lng,
            radiusKm: radius_km,
            page,
            limit,
          },
          redis,
        );

        return reply.send({ success: true, ...result });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });
}
