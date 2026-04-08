/**
 * Location routes — /api/v1/location/
 *
 * All routes require authentication to prevent anonymous abuse of
 * the Nominatim API (they require a legitimate User-Agent + responsible use).
 *
 *   GET /detect           → auto-detect from request IP
 *   GET /reverse?lat=&lng= → reverse geocode coordinates to address
 *   GET /search?q=        → forward geocode / location autocomplete
 */

import {
  detectLocationFromIp,
  reverseGeocode,
  searchLocation,
} from '../services/locationService.js';

function sendError(reply, err) {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';
  const message = err.message ?? 'An unexpected error occurred';
  return reply.status(statusCode).send({ success: false, error: { code, message } });
}

export default async function locationRoutes(fastify) {
  // ── GET /detect ────────────────────────────────────────────────────────────
  // Auto-detect location from the request's IP address.
  // Returns approximate lat/lng/district/state from ip-api.com.
  fastify.get('/detect', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        // Fastify puts the real IP in request.ip (honours X-Forwarded-For if trustProxy is set)
        const ip = request.ip;
        const location = await detectLocationFromIp(ip);

        if (!location) {
          return reply.status(200).send({
            success: true,
            location: null,
            message:
              'Could not determine location from IP address (private/loopback IP or service unavailable)',
          });
        }

        return reply.status(200).send({ success: true, location });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /reverse ───────────────────────────────────────────────────────────
  // Convert lat/lng to district, state, pincode, formatted address.
  fastify.get('/reverse', {
    onRequest: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        required: ['lat', 'lng'],
        properties: {
          lat: { type: 'number', minimum: -90, maximum: 90 },
          lng: { type: 'number', minimum: -180, maximum: 180 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const { lat, lng } = request.query;
        const location = await reverseGeocode(fastify.redis, lat, lng);
        return reply.status(200).send({ success: true, location });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /search ────────────────────────────────────────────────────────────
  // Forward geocode — location autocomplete for Indian locations.
  fastify.get('/search', {
    onRequest: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 2, maxLength: 200 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const results = await searchLocation(fastify.redis, request.query.q);
        return reply.status(200).send({ success: true, results });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });
}
