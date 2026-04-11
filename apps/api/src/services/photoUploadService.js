/**
 * Photo Upload Service — orchestrates the full issue-photo pipeline.
 *
 * Two-phase upload (same pattern as avatar upload):
 *   Phase 1 – requestUploadUrl()
 *     Client asks for a pre-signed S3 PUT URL. We validate the request and
 *     return a short-lived URL the client uploads directly to S3.
 *
 *   Phase 2 – confirmUpload()
 *     After the client finishes the S3 PUT, it calls this endpoint.
 *     We download the raw bytes, extract EXIF, validate GPS proximity,
 *     run image processing, write back the processed versions, and
 *     append the photo record to issues.photos JSONB.
 *
 *   Delete – deletePhoto()
 *     Removes a photo from S3 and splices it out of issues.photos.
 *     Updates is_verified_location flag after removal.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import pool from '../db/postgres.js';
import { ServiceError } from './userService.js';
import { extractExif, verifyLocation } from './exifService.js';
import { processImage } from './imageService.js';
import { generateThumbnailKey } from './uploadService.js';

// ── S3 client (mirrors uploadService.js config) ───────────────────────────────

const useLocalStack = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

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

const BUCKET = process.env.S3_BUCKET || 'prajashakti-media-dev';
const CDN_BASE = process.env.CLOUDFRONT_URL || `http://localhost:4566/${BUCKET}`;
const UPLOAD_TTL = 300; // pre-signed URL expires in 5 seconds

const MAX_PHOTOS = 5;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const GPS_THRESHOLD_METERS = 500;

const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MIME_TO_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function publicUrl(key) {
  return `${CDN_BASE}/${key}`;
}

/** Stream a GetObjectCommand response body into a Buffer. */
async function s3BufferFromKey(key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const chunks = [];
  for await (const chunk of res.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Fetch the current photos array from the DB.
 * Returns a parsed JS array (never null).
 */
async function getPhotos(issueId) {
  const { rows } = await pool.query('SELECT photos FROM issues WHERE id = $1', [issueId]);
  if (!rows.length) return null;
  // photos is stored as JSONB — pg driver already parses it
  return rows[0].photos ?? [];
}

/**
 * Persist the updated photos array and recalculate is_verified_location.
 */
async function savePhotos(issueId, photos) {
  const isVerified = photos.some((p) => p.verified === true);
  await pool.query(
    `UPDATE issues
     SET photos = $2::jsonb,
         is_verified_location = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [issueId, JSON.stringify(photos), isVerified],
  );
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Step 1: Generate a pre-signed PUT URL for a new issue photo.
 *
 * Validates:
 *   - issueId exists and belongs to userId
 *   - issue hasn't already reached MAX_PHOTOS
 *   - fileType is an allowed MIME type
 *
 * Returns { uploadUrl, fileKey, publicUrl, maxBytes }
 */
export async function requestUploadUrl(userId, issueId, fileType) {
  if (!ALLOWED_CONTENT_TYPES.has(fileType)) {
    throw new ServiceError(
      400,
      'INVALID_FILE_TYPE',
      `Unsupported file type. Allowed: ${[...ALLOWED_CONTENT_TYPES].join(', ')}`,
    );
  }

  // Verify issue ownership
  const { rows } = await pool.query('SELECT created_by, photos FROM issues WHERE id = $1', [
    issueId,
  ]);
  if (!rows.length) {
    throw new ServiceError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
  }
  if (rows[0].created_by !== userId) {
    throw new ServiceError(403, 'FORBIDDEN', 'Only the issue creator can upload photos');
  }

  const currentPhotos = rows[0].photos ?? [];
  if (currentPhotos.length >= MAX_PHOTOS) {
    throw new ServiceError(
      400,
      'MAX_PHOTOS_REACHED',
      `Maximum ${MAX_PHOTOS} photos allowed per issue`,
    );
  }

  const ext = MIME_TO_EXT[fileType];
  const fileKey = `issues/${issueId}/${randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: fileKey,
    ContentType: fileType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: UPLOAD_TTL });

  return {
    uploadUrl,
    fileKey,
    publicUrl: publicUrl(fileKey),
    maxBytes: MAX_BYTES,
  };
}

/**
 * Step 2: Confirm and process an uploaded photo.
 *
 * After the client has PUT the file to S3, call this to:
 *   1. Download raw bytes from S3
 *   2. Validate file size
 *   3. Extract EXIF GPS
 *   4. Validate GPS proximity to issue location (if coordinates exist)
 *   5. Resize + generate thumbnail
 *   6. Write processed main + thumbnail back to S3
 *   7. Append photo record to issues.photos JSONB
 *   8. Update issues.is_verified_location
 *
 * Returns the full photo metadata object that was appended.
 */
export async function confirmUpload(issueId, fileKey, userId) {
  // Re-check ownership and current state
  const { rows } = await pool.query(
    'SELECT created_by, photos, location_lat, location_lng FROM issues WHERE id = $1',
    [issueId],
  );
  if (!rows.length) throw new ServiceError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
  if (rows[0].created_by !== userId) {
    throw new ServiceError(403, 'FORBIDDEN', 'Only the issue creator can confirm uploads');
  }

  const currentPhotos = rows[0].photos ?? [];
  if (currentPhotos.length >= MAX_PHOTOS) {
    // Race condition guard — delete orphaned S3 object
    s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: fileKey })).catch(() => {});
    throw new ServiceError(400, 'MAX_PHOTOS_REACHED', `Maximum ${MAX_PHOTOS} photos per issue`);
  }

  // Validate the fileKey belongs to this issue (security guard)
  if (!fileKey.startsWith(`issues/${issueId}/`)) {
    throw new ServiceError(400, 'INVALID_FILE_KEY', 'File key does not belong to this issue');
  }

  // ── Download raw bytes ────────────────────────────────────────────────────
  let rawBuffer;
  try {
    rawBuffer = await s3BufferFromKey(fileKey);
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      throw new ServiceError(404, 'FILE_NOT_FOUND', 'Uploaded file not found in storage');
    }
    throw new ServiceError(502, 'S3_ERROR', 'Could not retrieve uploaded file');
  }

  // ── Size guard ────────────────────────────────────────────────────────────
  if (rawBuffer.length > MAX_BYTES) {
    s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: fileKey })).catch(() => {});
    throw new ServiceError(
      413,
      'FILE_TOO_LARGE',
      `File exceeds maximum size of ${MAX_BYTES / 1024 / 1024}MB`,
    );
  }

  // ── EXIF extraction ───────────────────────────────────────────────────────
  const exifData = await extractExif(rawBuffer);

  // ── GPS verification ──────────────────────────────────────────────────────
  const issueLat = parseFloat(rows[0].location_lat);
  const issueLng = parseFloat(rows[0].location_lng);

  let verified = false;
  let verificationDistance = null;
  let verificationFlag = null;

  if (exifData.hasGps) {
    const result = verifyLocation(exifData, { lat: issueLat, lng: issueLng }, GPS_THRESHOLD_METERS);
    verified = result.verified;
    verificationDistance = result.distanceMeters;
    if (!verified) {
      verificationFlag = 'location_mismatch';
    }
  } else {
    verificationFlag = 'no_gps_data';
  }

  // ── Image processing ──────────────────────────────────────────────────────
  const processed = await processImage(rawBuffer);

  // ── Write processed versions back to S3 ──────────────────────────────────
  const thumbnailKey = generateThumbnailKey(fileKey);

  await Promise.all([
    s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: fileKey,
        Body: processed.main,
        ContentType: 'image/jpeg',
      }),
    ),
    s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: thumbnailKey,
        Body: processed.thumbnail,
        ContentType: 'image/jpeg',
      }),
    ),
  ]);

  // ── Build photo record ────────────────────────────────────────────────────
  const photo = {
    fileKey,
    publicUrl: publicUrl(fileKey),
    thumbnailUrl: publicUrl(thumbnailKey),
    width: processed.width,
    height: processed.height,
    uploadedAt: new Date().toISOString(),
    exif: {
      hasGps: exifData.hasGps,
      ...(exifData.latitude != null && { latitude: exifData.latitude }),
      ...(exifData.longitude != null && { longitude: exifData.longitude }),
      ...(exifData.capturedAt && { capturedAt: exifData.capturedAt }),
      ...(exifData.camera && { camera: exifData.camera }),
    },
    verified,
    verificationDistance,
    ...(verificationFlag && { verificationFlag }),
  };

  // ── Persist ───────────────────────────────────────────────────────────────
  const updatedPhotos = [...currentPhotos, photo];
  await savePhotos(issueId, updatedPhotos);

  return photo;
}

/**
 * Delete a photo from an issue.
 * Removes from S3 (main + thumbnail) and splices from issues.photos JSONB.
 * Recalculates is_verified_location after removal.
 *
 * @param {string} issueId
 * @param {string} fileKey   - The fileKey stored in the photo record
 * @param {string} userId
 * @param {string} userRole
 */
export async function deletePhoto(issueId, fileKey, userId, userRole) {
  const { rows } = await pool.query('SELECT created_by, photos FROM issues WHERE id = $1', [
    issueId,
  ]);
  if (!rows.length) throw new ServiceError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
  if (rows[0].created_by !== userId && userRole !== 'admin') {
    throw new ServiceError(403, 'FORBIDDEN', 'Only the issue creator can delete photos');
  }

  const photos = rows[0].photos ?? [];
  const index = photos.findIndex((p) => p.fileKey === fileKey);
  if (index === -1) throw new ServiceError(404, 'PHOTO_NOT_FOUND', 'Photo not found on this issue');

  // Remove from array
  const updatedPhotos = photos.filter((_, i) => i !== index);
  await savePhotos(issueId, updatedPhotos);

  // Delete from S3 (fire-and-forget — DB is the source of truth)
  const thumbKey = generateThumbnailKey(fileKey);
  Promise.all([
    s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: fileKey })).catch(() => {}),
    s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: thumbKey })).catch(() => {}),
  ]);

  return { deleted: true, remainingPhotos: updatedPhotos.length };
}
