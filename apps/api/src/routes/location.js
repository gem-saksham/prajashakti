/**
 * Location routes — /api/v1/location/
 *
 * Public routes (no auth):
 *   GET /states                        → list all states/UTs
 *   GET /states/:code/districts        → list districts for a state
 *
 * Authenticated routes:
 *   GET /detect                        → auto-detect from request IP
 *   GET /reverse?lat=&lng=             → reverse geocode to address
 *   GET /search?q=                     → forward geocode / autocomplete
 *   GET /jurisdiction?lat=&lng=        → rich jurisdiction with LGD codes
 *   GET /responsible-departments?lat=&lng=&category= → ranked dept list
 */

import {
  detectLocationFromIp,
  reverseGeocode,
  searchLocation,
  getJurisdiction,
  findResponsibleDepartments,
} from '../services/locationService.js';
import * as LocationModel from '../models/location.js';
import { isWithinIndia } from '../utils/locationValidator.js';

const STATES_CACHE_TTL = 86400; // 24 hours
const DISTRICTS_CACHE_TTL = 86400;

function sendError(reply, err) {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';
  const message = err.message ?? 'An unexpected error occurred';
  return reply.status(statusCode).send({ success: false, error: { code, message } });
}

export default async function locationRoutes(fastify) {
  // ── GET /states ────────────────────────────────────────────────────────────
  // Public — list all states and union territories.
  fastify.get('/states', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['state', 'ut'] },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const cacheKey = `location:states:${request.query.type || 'all'}`;
        const cached = await fastify.redis.get(cacheKey);
        if (cached) return reply.status(200).send({ success: true, states: JSON.parse(cached) });

        const states = await LocationModel.listStates({ type: request.query.type });
        await fastify.redis.setex(cacheKey, STATES_CACHE_TTL, JSON.stringify(states));

        return reply.status(200).send({ success: true, states });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /states/:code/districts ────────────────────────────────────────────
  // Public — list districts for a specific state.
  fastify.get('/states/:code/districts', {
    schema: {
      params: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string', minLength: 2, maxLength: 5 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const code = request.params.code.toUpperCase();
        const cacheKey = `location:districts:${code}`;
        const cached = await fastify.redis.get(cacheKey);
        if (cached) {
          return reply.status(200).send({ success: true, districts: JSON.parse(cached) });
        }

        const state = await LocationModel.getStateByCode(code);
        if (!state) {
          return reply
            .status(404)
            .send({
              success: false,
              error: { code: 'STATE_NOT_FOUND', message: 'State not found' },
            });
        }

        const districts = await LocationModel.listDistrictsByStateCode(code);
        await fastify.redis.setex(cacheKey, DISTRICTS_CACHE_TTL, JSON.stringify(districts));

        return reply.status(200).send({ success: true, state, districts });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /detect ────────────────────────────────────────────────────────────
  // Auto-detect location from the request's IP address.
  fastify.get('/detect', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
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

  // ── GET /jurisdiction ──────────────────────────────────────────────────────
  // Rich jurisdiction lookup: state + district with LGD codes.
  fastify.get('/jurisdiction', {
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

        if (!isWithinIndia(lat, lng)) {
          return reply.status(400).send({
            success: false,
            error: { code: 'OUTSIDE_INDIA', message: 'Coordinates are outside India' },
          });
        }

        const jurisdiction = await getJurisdiction(fastify.redis, lat, lng);
        return reply.status(200).send({ success: true, jurisdiction });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /responsible-departments ───────────────────────────────────────────
  // Find responsible government departments for a location + category.
  fastify.get('/responsible-departments', {
    onRequest: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        required: ['lat', 'lng'],
        properties: {
          lat: { type: 'number', minimum: -90, maximum: 90 },
          lng: { type: 'number', minimum: -180, maximum: 180 },
          category: { type: 'string', maxLength: 100 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        const { lat, lng, category } = request.query;

        if (!isWithinIndia(lat, lng)) {
          return reply.status(400).send({
            success: false,
            error: { code: 'OUTSIDE_INDIA', message: 'Coordinates are outside India' },
          });
        }

        const departments = await findResponsibleDepartments(
          fastify.redis,
          lat,
          lng,
          category || null,
        );
        return reply.status(200).send({ success: true, departments });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });
}
