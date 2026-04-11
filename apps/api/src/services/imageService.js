/**
 * Image Processing Service — resize, thumbnail, watermark.
 *
 * All image processing goes through sharp. Output is always JPEG
 * to ensure consistent MIME type downstream.
 *
 * Called by photoUploadService.confirmUpload after EXIF extraction,
 * before writing back to S3.
 */

import sharp from 'sharp';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAIN_MAX_WIDTH = 1600;
const MAIN_JPEG_QUALITY = 85;
const THUMB_SIZE = 400;
const THUMB_JPEG_QUALITY = 80;

// ── Exported functions ────────────────────────────────────────────────────────

/**
 * Resize and normalise an image buffer.
 * - Main image: max 1600 px wide, JPEG quality 85, progressive, auto-rotated
 * - Thumbnail: 400×400 cover crop, JPEG quality 80
 *
 * @param {Buffer} buffer - Raw image bytes
 * @returns {Promise<{
 *   main: Buffer,
 *   thumbnail: Buffer,
 *   width: number,
 *   height: number,
 *   format: string,
 * }>}
 */
export async function processImage(buffer) {
  const metadata = await sharp(buffer).metadata();

  const main = await sharp(buffer)
    .rotate() // auto-rotate from EXIF orientation tag
    .resize({ width: MAIN_MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: MAIN_JPEG_QUALITY, progressive: true })
    .toBuffer();

  const thumbnail = await sharp(buffer)
    .rotate()
    .resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: 'cover' })
    .jpeg({ quality: THUMB_JPEG_QUALITY })
    .toBuffer();

  return {
    main,
    thumbnail,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    format: metadata.format ?? 'jpeg',
  };
}

/**
 * Embed an evidence watermark onto an image buffer.
 * Composites a semi-transparent banner at the bottom-right corner
 * containing the issue ID prefix, GPS coordinates, and capture date.
 *
 * This is the Phase 2 integrity chain hook — watermarked images are
 * harder to forge and reference the original issue without external lookup.
 *
 * @param {Buffer} buffer
 * @param {{ issueId: string, lat: number, lng: number, timestamp: Date|string }} opts
 * @returns {Promise<Buffer>}
 */
export async function watermarkImage(buffer, { issueId, lat, lng, timestamp }) {
  const dateStr = new Date(timestamp).toISOString().slice(0, 10);
  const text = `PrajaShakti • ${issueId.slice(0, 8)} • ${lat.toFixed(4)},${lng.toFixed(4)} • ${dateStr}`;

  // SVG banner: 800×40 with semi-transparent black background
  const svg = `<svg width="800" height="40" xmlns="http://www.w3.org/2000/svg">
    <rect width="800" height="40" fill="rgba(0,0,0,0.6)"/>
    <text x="10" y="26" font-family="Arial,sans-serif" font-size="14" fill="white">${escapeXml(text)}</text>
  </svg>`;

  return sharp(buffer)
    .composite([{ input: Buffer.from(svg), gravity: 'southeast' }])
    .jpeg({ quality: MAIN_JPEG_QUALITY })
    .toBuffer();
}

// ── Internal ──────────────────────────────────────────────────────────────────

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
