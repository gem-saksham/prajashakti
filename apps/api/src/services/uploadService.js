/**
 * Upload Service — S3 pre-signed URL generation.
 *
 * Client-side upload flow:
 *   1. Client calls POST /users/me/avatar-upload-url → gets { uploadUrl, fileKey, publicUrl }
 *   2. Client PUT's the file bytes directly to uploadUrl (never touches our server)
 *   3. Client calls PATCH /users/me with { avatarUrl: publicUrl } to persist it
 *
 * In development, all requests go to LocalStack (http://localhost:4566).
 * In production, real AWS S3 + optional CloudFront CDN.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

// ─── S3 client ────────────────────────────────────────────────────────────────

// Use LocalStack in both development and test modes
const useLocalStack = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  // SDK v3.300+ adds CRC32 checksums by default; disable so pre-signed URLs work
  // from plain browser fetch/XHR (which can't compute the SDK checksum).
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

const BUCKET = process.env.S3_BUCKET || 'prajashakti-media-dev';
const CDN_BASE = process.env.CLOUDFRONT_URL || `http://localhost:4566/${BUCKET}`;
const UPLOAD_TTL = 300; // pre-signed URL expires in 5 minutes

// ─── Config per folder ────────────────────────────────────────────────────────

const FOLDER_CONFIG = {
  avatars: { maxBytes: 5 * 1024 * 1024, contentTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  issues: { maxBytes: 10 * 1024 * 1024, contentTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  evidence: {
    maxBytes: 10 * 1024 * 1024,
    contentTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'],
  },
};

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
};

// ─── Exported functions ───────────────────────────────────────────────────────

/**
 * Generate a pre-signed PUT URL for direct-to-S3 upload.
 *
 * @param {string} userId   - The authenticated user's UUID
 * @param {string} fileType - MIME type (e.g. "image/jpeg")
 * @param {string} folder   - One of: 'avatars', 'issues', 'evidence'
 * @returns {{ uploadUrl: string, fileKey: string, publicUrl: string, maxBytes: number }}
 */
export async function generateUploadUrl(userId, fileType, folder = 'avatars') {
  const config = FOLDER_CONFIG[folder];
  if (!config) {
    const err = new Error(
      `Invalid folder. Must be one of: ${Object.keys(FOLDER_CONFIG).join(', ')}`,
    );
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (!config.contentTypes.includes(fileType)) {
    const err = new Error(
      `Invalid file type "${fileType}". Allowed: ${config.contentTypes.join(', ')}`,
    );
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const ext = MIME_TO_EXT[fileType];
  const fileKey = `${folder}/${userId}/${randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: fileKey,
    ContentType: fileType,
    // ContentLength omitted — SDK v3 adds a mandatory CRC32 checksum when it's set,
    // which the browser client cannot reproduce. Max-size is enforced client-side.
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: UPLOAD_TTL });
  const publicUrl = `${CDN_BASE}/${fileKey}`;

  return { uploadUrl, fileKey, publicUrl, maxBytes: config.maxBytes };
}

/**
 * Upload a raw buffer directly to S3 (server-side proxy upload).
 * Used by mobile clients that can't reach LocalStack directly in dev.
 *
 * @param {string} userId
 * @param {Buffer} buffer
 * @param {string} fileType - MIME type
 * @param {string} folder
 * @returns {{ publicUrl: string, fileKey: string }}
 */
export async function uploadBuffer(userId, buffer, fileType, folder = 'avatars') {
  const config = FOLDER_CONFIG[folder];
  if (!config) {
    const err = new Error(`Invalid folder: ${folder}`);
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (!config.contentTypes.includes(fileType)) {
    const err = new Error(`Invalid file type: ${fileType}`);
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (buffer.length > config.maxBytes) {
    const err = new Error(`File too large. Max ${config.maxBytes / 1024 / 1024}MB`);
    err.statusCode = 413;
    err.code = 'FILE_TOO_LARGE';
    throw err;
  }

  const ext = MIME_TO_EXT[fileType];
  const fileKey = `${folder}/${userId}/${randomUUID()}.${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: fileKey,
      Body: buffer,
      ContentType: fileType,
    }),
  );

  return { fileKey, publicUrl: `${CDN_BASE}/${fileKey}` };
}

/**
 * Delete a file from S3 by its key.
 * Called when a user replaces or removes their avatar.
 *
 * @param {string} fileKey - e.g. "avatars/uuid/abc.jpg"
 */
export async function deleteFile(fileKey) {
  if (!fileKey) return;

  // Only delete keys that belong to our bucket structure (safety guard)
  const validPrefix = /^(avatars|issues|evidence)\//;
  if (!validPrefix.test(fileKey)) return;

  try {
    const command = new DeleteObjectCommand({ Bucket: BUCKET, Key: fileKey });
    await s3.send(command);
  } catch (err) {
    // Non-fatal — log but don't surface to caller.
    // The DB record will still be cleared; the orphaned S3 object is acceptable.
    console.error('[uploadService] deleteFile error (non-fatal):', err.message);
  }
}

/**
 * Returns the expected thumbnail key for a given original file key.
 * Thumbnails are generated asynchronously by a Lambda; this just derives the path.
 *
 * e.g. "avatars/uid/abc.jpg" → "avatars/uid/abc_thumb.jpg"
 *
 * @param {string} fileKey
 * @returns {string}
 */
export function generateThumbnailKey(fileKey) {
  const lastDot = fileKey.lastIndexOf('.');
  if (lastDot === -1) return `${fileKey}_thumb`;
  return `${fileKey.slice(0, lastDot)}_thumb${fileKey.slice(lastDot)}`;
}

/**
 * Extract the S3 key from a full public URL.
 * Used to get the key when we only have the stored publicUrl.
 *
 * @param {string} publicUrl
 * @returns {string|null}
 */
export function extractKeyFromUrl(publicUrl) {
  if (!publicUrl) return null;
  try {
    const base = CDN_BASE.endsWith('/') ? CDN_BASE : `${CDN_BASE}/`;
    if (publicUrl.startsWith(base)) {
      return publicUrl.slice(base.length);
    }
    // Fallback: parse URL and strip leading slash
    const url = new URL(publicUrl);
    const path = url.pathname.replace(/^\/[^/]+\//, ''); // strip bucket name
    return path || null;
  } catch {
    return null;
  }
}
