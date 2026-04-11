/**
 * EXIF Service — extract GPS and camera metadata from image buffers.
 *
 * Used by the photo upload pipeline to enforce geo-tag requirements
 * and build the evidence integrity chain for Phase 2 Reality Check.
 */

import exifr from 'exifr';

/**
 * Extract EXIF metadata from an image buffer.
 * Returns a normalised object regardless of whether EXIF is present.
 *
 * @param {Buffer} buffer
 * @returns {Promise<{
 *   hasGps: boolean,
 *   latitude?: number,
 *   longitude?: number,
 *   altitude?: number,
 *   capturedAt?: Date,
 *   camera?: string,
 * }>}
 */
export async function extractExif(buffer) {
  try {
    const data = await exifr.parse(buffer, {
      gps: true,
      exif: true,
      pick: ['GPSLatitude', 'GPSLongitude', 'GPSAltitude', 'DateTimeOriginal', 'Make', 'Model'],
    });

    if (!data) return { hasGps: false };

    const lat = data.latitude;
    const lng = data.longitude;

    return {
      hasGps: lat != null && lng != null,
      latitude: lat ?? undefined,
      longitude: lng ?? undefined,
      altitude: data.GPSAltitude ?? undefined,
      capturedAt: data.DateTimeOriginal ?? undefined,
      camera: data.Make && data.Model ? `${data.Make} ${data.Model}`.trim() : undefined,
    };
  } catch {
    return { hasGps: false };
  }
}

/**
 * Haversine distance between two GPS coordinates, in metres.
 *
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} Distance in metres
 */
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Verify whether an EXIF GPS position is within a threshold of an issue location.
 *
 * @param {{ latitude: number, longitude: number }} exif
 * @param {{ lat: number, lng: number }} issueLoc
 * @param {number} [thresholdMeters=500]
 * @returns {{ verified: boolean, distanceMeters: number }}
 */
export function verifyLocation(exif, issueLoc, thresholdMeters = 500) {
  if (!exif.hasGps || exif.latitude == null || exif.longitude == null) {
    return { verified: false, distanceMeters: null };
  }
  const dist = distanceMeters(exif.latitude, exif.longitude, issueLoc.lat, issueLoc.lng);
  return { verified: dist <= thresholdMeters, distanceMeters: Math.round(dist) };
}
