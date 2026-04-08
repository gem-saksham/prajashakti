/**
 * User routes — /api/v1/users/
 *
 * Auth flow:
 *   POST /register              → first-time only; creates user, sends OTP
 *   POST /login                 → existing user, sends OTP
 *   POST /verify-otp            → verify OTP, issue JWT
 *   POST /refresh               → exchange refresh token for new access token
 *   POST /logout                → blacklists access token + revokes refresh token
 *
 * Profile (authenticated):
 *   GET   /me                   → full profile with completeness score
 *   PATCH /me                   → update profile fields
 *   POST  /me/avatar-upload-url → get pre-signed S3 PUT URL
 *   DELETE /me/avatar           → remove avatar from S3 + DB
 *
 * Extended (authenticated):
 *   POST /link/google           → link Google account to phone user
 *   POST /verify-aadhaar        → initiate Aadhaar identity verification
 *
 * Public:
 *   GET /:id                    → public profile with stats
 *   GET /:id/activity           → public activity feed
 */

import { phoneSchema, otpSchema, uuidSchema } from '../middleware/validator.js';
import * as UserService from '../services/userService.js';
import * as UserModel from '../models/user.js';
import { getPublicActivity } from '../models/userActivity.js';
import { initiateVerification } from '../services/aadhaarService.js';
import {
  generateUploadUrl,
  uploadBuffer,
  deleteFile,
  extractKeyFromUrl,
} from '../services/uploadService.js';
import { otpRateLimit, otpCooldown, authEndpointLimit } from '../middleware/rateLimiter.js';
import { audit } from '../services/auditService.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendError(reply, err) {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';
  const message = err.message ?? 'An unexpected error occurred';
  return reply.status(statusCode).send({ success: false, error: { code, message } });
}

// ─── Route plugin ─────────────────────────────────────────────────────────────

export default async function userRoutes(fastify) {
  // ── POST /register ─────────────────────────────────────────────────────────
  fastify.post('/register', {
    onRequest: [authEndpointLimit(fastify.redis)],
    schema: {
      body: {
        type: 'object',
        required: ['phone', 'name'],
        properties: {
          phone: phoneSchema,
          name: { type: 'string', minLength: 2, maxLength: 100 },
        },
        additionalProperties: false,
      },
    },
    handler: async (request, reply) => {
      try {
        const { otp } = await UserService.initiateRegistration(fastify.redis, request.body);
        return reply.status(200).send({
          success: true,
          message: 'OTP sent to your mobile number',
          ...(process.env.NODE_ENV !== 'production' && { debug_otp: otp }),
        });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── POST /login ────────────────────────────────────────────────────────────
  fastify.post('/login', {
    onRequest: [authEndpointLimit(fastify.redis)],
    schema: {
      body: {
        type: 'object',
        required: ['phone'],
        properties: { phone: phoneSchema },
        additionalProperties: false,
      },
    },
    handler: async (request, reply) => {
      try {
        const { otp } = await UserService.initiateLogin(fastify.redis, request.body);
        return reply.status(200).send({
          success: true,
          message: 'OTP sent to your mobile number',
          ...(process.env.NODE_ENV !== 'production' && { debug_otp: otp }),
        });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── POST /verify-otp ───────────────────────────────────────────────────────
  fastify.post('/verify-otp', {
    onRequest: [authEndpointLimit(fastify.redis)],
    schema: {
      body: {
        type: 'object',
        required: ['phone', 'otp'],
        properties: {
          phone: phoneSchema,
          otp: otpSchema,
        },
        additionalProperties: false,
      },
    },
    handler: async (request, reply) => {
      try {
        const { user, accessToken, refreshToken } = await UserService.verifyOtpAndAuthenticate(
          fastify,
          request.body,
        );
        audit.loginSuccess(request, user.id);
        return reply.status(200).send({ success: true, user, accessToken, refreshToken });
      } catch (err) {
        if (err.code === 'VALIDATION_ERROR') audit.loginFailed(request, request.body?.phone);
        if (err.code === 'RATE_LIMITED') audit.otpLockout(request, request.body?.phone);
        return sendError(reply, err);
      }
    },
  });

  // ── POST /refresh ──────────────────────────────────────────────────────────
  fastify.post('/refresh', {
    schema: {
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: { refreshToken: { type: 'string', minLength: 1 } },
        additionalProperties: false,
      },
    },
    handler: async (request, reply) => {
      try {
        const { accessToken, refreshToken, user } = await UserService.refreshAccessToken(
          fastify,
          request.body,
          request,
        );
        audit.tokenRefresh(request, user.id);
        return reply.status(200).send({ success: true, accessToken, refreshToken, user });
      } catch (err) {
        if (err.code === 'TOKEN_REUSE') {
          audit.tokenReuseDetected(request, null, null);
        }
        return sendError(reply, err);
      }
    },
  });

  // ── POST /logout ───────────────────────────────────────────────────────────
  fastify.post('/logout', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: { refreshToken: { type: 'string' } },
        additionalProperties: false,
      },
    },
    handler: async (request, reply) => {
      try {
        const { id, iat, exp } = request.user;
        await UserService.logout(fastify.redis, {
          userId: id,
          iat,
          exp,
          refreshToken: request.body?.refreshToken,
        });
        audit.logout(request, id);
        return reply.status(200).send({ success: true, message: 'Logged out successfully' });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /me ────────────────────────────────────────────────────────────────
  fastify.get('/me', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const user = await UserService.getProfile(fastify.redis, request.user.id);
        return reply.status(200).send({ success: true, user });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── PATCH /me ──────────────────────────────────────────────────────────────
  fastify.patch('/me', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 100 },
          email: { type: 'string', format: 'email' },
          bio: { type: 'string', maxLength: 500 },
          avatarUrl: { type: 'string' },
          district: { type: 'string', maxLength: 100 },
          state: { type: 'string', maxLength: 100 },
          pincode: { type: 'string', pattern: '^\\d{6}$' },
          locationLat: { type: 'number', minimum: -90, maximum: 90 },
          locationLng: { type: 'number', minimum: -180, maximum: 180 },
        },
        additionalProperties: false,
        minProperties: 1,
      },
    },
    handler: async (request, reply) => {
      try {
        const user = await UserService.updateProfile(fastify.redis, request.user.id, request.body);
        return reply.status(200).send({ success: true, user });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── POST /me/avatar-upload-url ─────────────────────────────────────────────
  // Returns a pre-signed S3 PUT URL. The client uploads directly to S3.
  // After upload, the client calls PATCH /me with { avatarUrl: publicUrl }.
  fastify.post('/me/avatar-upload-url', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['fileType'],
        properties: {
          fileType: {
            type: 'string',
            enum: ['image/jpeg', 'image/png', 'image/webp'],
          },
        },
        additionalProperties: false,
      },
    },
    handler: async (request, reply) => {
      try {
        const { fileType } = request.body;
        const result = await generateUploadUrl(request.user.id, fileType, 'avatars');
        return reply.status(200).send({ success: true, ...result });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── POST /me/avatar — proxy upload (for mobile clients that can't reach S3) ─
  // Accepts raw image bytes in the request body. Uploads to S3 server-side.
  // Content-Type header must be image/jpeg, image/png, or image/webp.
  fastify.post('/me/avatar', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const fileType = request.headers['content-type']?.split(';')[0]?.trim();
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(fileType)) {
          return reply
            .status(400)
            .send({
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: `Invalid Content-Type. Must be one of: ${allowed.join(', ')}`,
              },
            });
        }

        const buffer = request.body;
        if (!buffer || !Buffer.isBuffer(buffer)) {
          return reply
            .status(400)
            .send({
              success: false,
              error: { code: 'VALIDATION_ERROR', message: 'Empty or invalid image body' },
            });
        }

        // Delete old avatar if present
        const existing = await UserModel.findById(request.user.id);
        if (existing?.avatarUrl) {
          const key = extractKeyFromUrl(existing.avatarUrl);
          await deleteFile(key);
        }

        const { publicUrl } = await uploadBuffer(request.user.id, buffer, fileType, 'avatars');
        const user = await UserService.updateProfile(fastify.redis, request.user.id, {
          avatarUrl: publicUrl,
        });
        return reply.status(200).send({ success: true, user, publicUrl });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── DELETE /me/avatar ──────────────────────────────────────────────────────
  // Deletes the current avatar from S3 and clears avatar_url in the DB.
  fastify.delete('/me/avatar', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const user = await UserModel.findById(request.user.id);
        if (!user)
          return reply
            .status(404)
            .send({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

        // Delete from S3 if there is a current avatar
        if (user.avatarUrl) {
          const key = extractKeyFromUrl(user.avatarUrl);
          await deleteFile(key);
        }

        const updated = await UserService.updateProfile(fastify.redis, request.user.id, {
          avatarUrl: null,
        });
        return reply.status(200).send({ success: true, user: updated });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── POST /link/google ──────────────────────────────────────────────────────
  fastify.post('/link/google', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['idToken'],
        properties: { idToken: { type: 'string', minLength: 1 } },
        additionalProperties: false,
      },
    },
    handler: async (request, reply) => {
      try {
        const user = await UserService.linkGoogleAccount(
          fastify.redis,
          request.user.id,
          request.body,
        );
        return reply.status(200).send({ success: true, user });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── POST /verify-aadhaar ───────────────────────────────────────────────────
  fastify.post('/verify-aadhaar', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const result = await initiateVerification(request.user.id);
        return reply.status(200).send({ success: true, ...result });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /:id — enhanced public profile ────────────────────────────────────
  // Returns public fields + live stats (issues raised, supported, comments).
  // Stats are cached in Redis for 5 minutes.
  fastify.get('/:id', {
    onRequest: [fastify.optionalAuth],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: uuidSchema },
      },
    },
    handler: async (request, reply) => {
      try {
        const user = await UserModel.findPublicById(request.params.id);
        if (!user) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'User not found' },
          });
        }

        // Stats with 5-minute Redis cache
        const statsCacheKey = `profile:stats:${user.id}`;
        let stats;
        const cachedStats = await fastify.redis.get(statsCacheKey);
        if (cachedStats) {
          stats = JSON.parse(cachedStats);
        } else {
          stats = await UserModel.getPublicStats(user.id);
          await fastify.redis.setex(statsCacheKey, 300, JSON.stringify(stats));
        }

        return reply.status(200).send({
          success: true,
          user: {
            id: user.id,
            name: user.name,
            avatarUrl: user.avatarUrl,
            bio: user.bio,
            district: user.district,
            state: user.state,
            role: user.role,
            isVerified: user.isVerified,
            reputationScore: user.reputationScore,
            stats,
            joinedAt: user.createdAt,
            lastActiveAt: user.lastLoginAt,
          },
        });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── GET /:id/activity — public activity feed ───────────────────────────────
  fastify.get('/:id/activity', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: uuidSchema },
      },
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
        // Verify user exists first
        const user = await UserModel.findPublicById(request.params.id);
        if (!user) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'User not found' },
          });
        }

        const { page = 1, limit = 20 } = request.query;
        const { activities, total } = await getPublicActivity(user.id, page, limit);

        return reply.status(200).send({
          success: true,
          data: activities,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });
}
