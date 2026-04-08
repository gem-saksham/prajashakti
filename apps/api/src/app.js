/**
 * App factory — buildApp({ db, redis })
 *
 * Extracted from server.js so that tests can create an app instance with
 * injected test DB / Redis connections without starting a real HTTP server.
 *
 * server.js calls buildApp() then fastify.listen().
 * Tests call buildApp({ db: testPool, redis: testRedis }) then fastify.inject().
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import defaultPool, { checkHealth as pgHealth } from './db/postgres.js';
import defaultRedis, { checkHealth as redisHealth } from './db/redis.js';

import { authenticate, optionalAuth, requireRole, requireVerified } from './middleware/auth.js';
import { addRequestIdHooks } from './middleware/requestId.js';
import { addLoggerHooks } from './middleware/logger.js';
import { registerErrorHandler } from './middleware/errorHandler.js';
import { sanitiserHook } from './middleware/sanitiser.js';

import v1Routes from './middleware/versioning.js';
import healthRoutes from './routes/health.js';

// ─── Factory ──────────────────────────────────────────────────────────────────

export async function buildApp({ db = defaultPool, redis = defaultRedis } = {}) {
  const isTest = process.env.NODE_ENV === 'test';
  const isProd = process.env.NODE_ENV === 'production';

  const fastify = Fastify({
    disableRequestLogging: true,
    logger: {
      level: isTest ? 'silent' : isProd ? 'info' : 'warn',
      transport:
        !isTest && !isProd
          ? { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname' } }
          : undefined,
      redact: ['req.headers.authorization'],
    },
  });

  // ── Global plugins ──────────────────────────────────────────────────────────

  // Swagger / OpenAPI — dev only (not exposed in production)
  if (!isProd) {
    await fastify.register(swagger, {
      openapi: {
        openapi: '3.0.0',
        info: {
          title: 'PrajaShakti API',
          description: 'Civic engagement platform for India — Sprint 1',
          version: '1.0.0',
          contact: {
            name: 'PrajaShakti Platform Engineering',
          },
        },
        servers: [{ url: 'http://localhost:3000', description: 'Local dev' }],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
        security: [{ bearerAuth: [] }],
        tags: [
          { name: 'health', description: 'Health checks' },
          { name: 'auth', description: 'Authentication — OTP flow' },
          { name: 'profile', description: 'User profile management' },
          { name: 'public', description: 'Public-facing endpoints' },
          { name: 'location', description: 'Geocoding & location services' },
          { name: 'media', description: 'Media proxy (S3)' },
        ],
      },
    });

    await fastify.register(swaggerUi, {
      routePrefix: '/api/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
        tryItOutEnabled: true,
      },
      staticCSP: true,
    });
  }

  await fastify.register(cors, {
    origin: (origin, callback) => {
      const allowed = isProd ? ['https://prajashakti.in', 'https://www.prajashakti.in'] : true;

      // Allow no-origin requests (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      if (allowed === true || (Array.isArray(allowed) && allowed.includes(origin))) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-ID'],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Request-ID',
    ],
    maxAge: 86400, // cache preflight for 24h
  });

  await fastify.register(helmet, {
    // Strict Content-Security-Policy
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'https://api.prajashakti.in'],
            frameAncestors: ["'none'"],
            formAction: ["'self'"],
            baseUri: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
          },
        }
      : false, // disable CSP in dev (Vite HMR needs relaxed policy)
    crossOriginEmbedderPolicy: false, // required for some media/blob URLs
    hsts: isProd
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        }
      : false,
    // These are set by Helmet by default — explicitly confirm:
    xContentTypeOptions: true, // X-Content-Type-Options: nosniff
    frameguard: { action: 'deny' }, // X-Frame-Options: DENY
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
  });

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    sign: { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '7d' },
  });

  // ── Decorators ──────────────────────────────────────────────────────────────

  fastify.decorate('db', db);
  fastify.decorate('redis', redis);
  fastify.decorate('pgHealth', pgHealth);
  fastify.decorate('redisHealth', redisHealth);

  fastify.decorate('authenticate', authenticate);
  fastify.decorate('optionalAuth', optionalAuth);
  fastify.decorate('requireRole', requireRole);
  fastify.decorate('requireVerified', requireVerified);

  // ── Binary content-type parser (for proxy avatar upload) ───────────────────
  // Fastify only parses application/json by default. Register image/* types
  // so POST /me/avatar can receive raw image bytes as a Buffer.
  for (const mime of ['image/jpeg', 'image/png', 'image/webp']) {
    fastify.addContentTypeParser(mime, { parseAs: 'buffer' }, (_req, body, done) =>
      done(null, body),
    );
  }

  // ── Hooks ───────────────────────────────────────────────────────────────────

  addRequestIdHooks(fastify);
  if (!isTest) addLoggerHooks(fastify); // suppress request logs in tests

  // Global input sanitisation — runs after body parsing, before route handlers
  fastify.addHook('preValidation', sanitiserHook);

  // ── Error handling ──────────────────────────────────────────────────────────

  registerErrorHandler(fastify);

  // ── Routes ──────────────────────────────────────────────────────────────────

  await fastify.register(healthRoutes, { prefix: '/api' });
  await fastify.register(v1Routes, { prefix: '/api/v1' });

  return fastify;
}
