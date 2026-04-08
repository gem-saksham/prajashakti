/**
 * Media proxy routes — /api/v1/media/
 *
 * In development, LocalStack runs on port 4566 which may be inaccessible
 * from physical devices on the LAN (blocked by host firewall).
 * This proxy fetches S3 objects server-side and streams them to the client,
 * so devices only need to reach port 3000 (the API server).
 *
 * GET /api/v1/media/:folder/:userId/:filename
 *   e.g. /api/v1/media/avatars/abc123/photo.jpg
 *
 * Only enabled in development/test. In production, CloudFront serves media directly.
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const useLocalStack = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const BUCKET = process.env.S3_BUCKET || 'prajashakti-media-dev';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
  ...(useLocalStack && {
    endpoint: process.env.AWS_S3_ENDPOINT || 'http://localhost:4566',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    },
  }),
});

// Only valid top-level folders (security guard — prevents path traversal)
const VALID_FOLDERS = new Set(['avatars', 'issues', 'evidence']);

export default async function mediaRoutes(fastify) {
  fastify.get('/*', async (request, reply) => {
    const key = request.params['*'];

    // Guard: key must start with a known folder
    const folder = key.split('/')[0];
    if (!VALID_FOLDERS.has(folder)) {
      return reply.status(404).send({ error: 'Not found' });
    }

    try {
      const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));

      reply.header('Content-Type', result.ContentType || 'application/octet-stream');
      reply.header('Cache-Control', 'public, max-age=3600');
      if (result.ContentLength) {
        reply.header('Content-Length', result.ContentLength);
      }

      // result.Body is a Node.js Readable stream — Fastify streams it directly
      return reply.send(result.Body);
    } catch (err) {
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        return reply.status(404).send({ error: 'Not found' });
      }
      fastify.log.error({ err, key }, '[media] S3 fetch error');
      return reply.status(502).send({ error: 'Could not fetch media' });
    }
  });
}
