/**
 * Tag suggestion route — /api/v1/issues/suggest-tags
 *
 * Called in real-time (debounced 500ms) as the user types the issue creation form.
 * Returns suggested grievance categories, ministries, departments, and officials.
 *
 * Rate limited: 20 suggestions/hour per user (via @fastify/rate-limit config in app.js).
 */

import { autoSuggest } from '../services/tagSuggestionService.js';

function sendError(reply, err) {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';
  const message = err.message ?? 'An unexpected error occurred';
  return reply.status(statusCode).send({ success: false, error: { code, message } });
}

export default async function tagSuggestionRoutes(fastify) {
  /**
   * POST /api/v1/issues/suggest-tags
   *
   * Body: { title, description, category, location_lat, location_lng }
   * Response: { grievanceCategories, ministries, departments, suggestedOfficials }
   */
  fastify.post('/suggest-tags', {
    onRequest: [fastify.authenticate],
    config: {
      // 20 suggestions per hour in production; unlimited in test to avoid in-memory counter bleed
      rateLimit: {
        max: process.env.NODE_ENV === 'test' ? 10000 : 20,
        timeWindow: '1 hour',
      },
    },
    schema: {
      body: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 200 },
          description: { type: 'string', maxLength: 2000 },
          category: {
            type: 'string',
            enum: [
              'Infrastructure',
              'Healthcare',
              'Education',
              'Safety',
              'Environment',
              'Agriculture',
              'Corruption',
              'Other',
            ],
          },
          location_lat: { type: 'number', minimum: 6, maximum: 38 },
          location_lng: { type: 'number', minimum: 68, maximum: 98 },
        },
        additionalProperties: false,
      },
    },
    handler: async (request, reply) => {
      try {
        const { title, description, category, location_lat, location_lng } = request.body;

        const suggestions = await autoSuggest(
          {
            title,
            description: description || '',
            category: category || null,
            locationLat: location_lat ?? null,
            locationLng: location_lng ?? null,
          },
          fastify.redis,
        );

        return reply.status(200).send({ success: true, suggestions });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });
}
