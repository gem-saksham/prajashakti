/**
 * Photo routes — /api/v1/issues/:issueId/photos/
 *
 * POST /upload-url   — request a pre-signed S3 PUT URL (creator only)
 * POST /confirm      — confirm upload, run EXIF + image processing (creator only)
 * DELETE /:photoKey  — remove a photo (creator or admin)
 *
 * All routes require authentication.
 */

import { authenticate } from '../middleware/auth.js';
import { uuidSchema } from '../middleware/validator.js';
import * as PhotoService from '../services/photoUploadService.js';

// ── Helper ────────────────────────────────────────────────────────────────────

function sendError(reply, err) {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';
  const message = err.message ?? 'An unexpected error occurred';
  return reply.status(statusCode).send({ success: false, error: { code, message } });
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default async function photoRoutes(fastify) {
  // Shared param schema for all routes in this plugin
  const issueParams = {
    type: 'object',
    required: ['issueId'],
    properties: { issueId: uuidSchema },
  };

  // ── POST /upload-url ───────────────────────────────────────────────────────
  fastify.post('/upload-url', {
    onRequest: [authenticate],
    schema: {
      params: issueParams,
      body: {
        type: 'object',
        required: ['file_type'],
        properties: {
          file_type: {
            type: 'string',
            enum: ['image/jpeg', 'image/png', 'image/webp'],
            description: 'MIME type of the image to upload',
          },
        },
        additionalProperties: false,
      },
    },
    handler: async (request, reply) => {
      try {
        const result = await PhotoService.requestUploadUrl(
          request.user.id,
          request.params.issueId,
          request.body.file_type,
        );
        return reply.status(200).send({ success: true, data: result });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── POST /confirm ──────────────────────────────────────────────────────────
  fastify.post('/confirm', {
    onRequest: [authenticate],
    schema: {
      params: issueParams,
      body: {
        type: 'object',
        required: ['file_key'],
        properties: {
          file_key: {
            type: 'string',
            pattern: '^issues/[a-f0-9-]+/[a-f0-9-]+\\.(jpg|png|webp)$',
            maxLength: 200,
            description: 'The fileKey returned by /upload-url',
          },
        },
        additionalProperties: false,
      },
    },
    handler: async (request, reply) => {
      try {
        const photo = await PhotoService.confirmUpload(
          request.params.issueId,
          request.body.file_key,
          request.user.id,
        );
        return reply.status(201).send({ success: true, data: photo });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });

  // ── DELETE /:photoKey ──────────────────────────────────────────────────────
  // photoKey is base64url-encoded so it survives URL transport without
  // double-encoding slashes — encode on client, decode here.
  fastify.delete('/:photoKey', {
    onRequest: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['issueId', 'photoKey'],
        properties: {
          issueId: uuidSchema,
          photoKey: { type: 'string', maxLength: 300 },
        },
      },
    },
    handler: async (request, reply) => {
      try {
        // photoKey arrives as base64url — decode to recover the original S3 key
        const fileKey = Buffer.from(request.params.photoKey, 'base64url').toString('utf8');

        const result = await PhotoService.deletePhoto(
          request.params.issueId,
          fileKey,
          request.user.id,
          request.user.role,
        );
        return reply.send({ success: true, data: result });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  });
}
