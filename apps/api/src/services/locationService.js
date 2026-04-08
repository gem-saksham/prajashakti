/**
 * Location Service — IP detection, reverse geocoding, forward search.
 *
 * External APIs used:
 *   - ip-api.com        (IP geolocation, free, no key needed)
 *   - Nominatim OSM     (reverse + forward geocode, free, no key needed)
 *
 * Nominatim rate limit: 1 request/second. We enforce this via a simple
 * in-process timestamp guard. Redis caching reduces actual call volume.
 *
 * User-Agent is required by Nominatim TOS.
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const NOMINATIM_UA =
  process.env.NOMINATIM_USER_AGENT || 'PrajaShakti/1.0 (civic-platform; contact@prajashakti.in)';
const GEO_CACHE_TTL = 86400; // 24 hours for reverse geocode
const SEARCH_CACHE_TTL = 3600; // 1 hour for search results

// Simple in-process rate limiter for Nominatim (1 req/sec)
let _lastNominatimCall = 0;

async function nominatimFetch(url) {
  const now = Date.now();
  const wait = 1000 - (now - _lastNominatimCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  _lastNominatimCall = Date.now();

  const res = await fetch(url, {
    headers: { 'User-Agent': NOMINATIM_UA, 'Accept-Language': 'en' },
  });
  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
  return res.json();
}

// ─── IP Geolocation ───────────────────────────────────────────────────────────

/**
 * Detect approximate location from an IP address using ip-api.com (free tier).
 * Falls back gracefully if the call fails.
 *
 * @param {string} ipAddress
 * @returns {{ lat: number, lng: number, district: string, state: string, pincode: string|null, accuracy: 'ip' }|null}
 */
export async function detectLocationFromIp(ipAddress) {
  // Skip loopback/private IPs — ip-api won't resolve them
  if (
    !ipAddress ||
    ipAddress === '127.0.0.1' ||
    ipAddress === '::1' ||
    ipAddress.startsWith('192.168.') ||
    ipAddress.startsWith('10.')
  ) {
    return null;
  }

  try {
    const res = await fetch(
      `http://ip-api.com/json/${ipAddress}?fields=status,lat,lon,regionName,city,zip`,
      { signal: AbortSignal.timeout(3000) },
    );
    const data = await res.json();

    if (data.status !== 'success') return null;

    return {
      lat: data.lat,
      lng: data.lon,
      district: data.city || data.regionName || null,
      state: data.regionName || null,
      pincode: data.zip || null,
      accuracy: 'ip',
    };
  } catch {
    return null;
  }
}

// ─── Reverse Geocode ──────────────────────────────────────────────────────────

/**
 * Convert lat/lng to district, state, pincode using Nominatim.
 * Results are cached in Redis for 24 hours (rounded to 3 decimal places ~111m).
 *
 * @param {object} redis
 * @param {number} lat
 * @param {number} lng
 * @returns {{ district: string, state: string, pincode: string|null, formattedAddress: string }}
 */
export async function reverseGeocode(redis, lat, lng) {
  // Round to 3dp for cache key (~111m accuracy, avoids too many unique keys)
  const latR = parseFloat(lat).toFixed(3);
  const lngR = parseFloat(lng).toFixed(3);
  const cacheKey = `geo:${latR}:${lngR}`;

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const data = await nominatimFetch(
    `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
  );

  const addr = data.address || {};
  const result = {
    district: addr.county || addr.state_district || addr.city || addr.town || addr.village || null,
    state: addr.state || null,
    pincode: addr.postcode || null,
    formattedAddress: data.display_name || null,
  };

  await redis.setex(cacheKey, GEO_CACHE_TTL, JSON.stringify(result));
  return result;
}

// ─── Forward Search ───────────────────────────────────────────────────────────

/**
 * Forward geocode / autocomplete for Indian locations.
 * Results cached in Redis for 1 hour.
 *
 * @param {object} redis
 * @param {string} query
 * @returns {Array<{ displayName: string, lat: number, lng: number, district: string, state: string }>}
 */
export async function searchLocation(redis, query) {
  if (!query || query.trim().length < 2) return [];

  const cacheKey = `geo:search:${query.toLowerCase().trim()}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const encoded = encodeURIComponent(query);
  const data = await nominatimFetch(
    `${NOMINATIM_BASE}/search?q=${encoded}&format=json&addressdetails=1&limit=5&countrycodes=in`,
  );

  const results = data.map((item) => {
    const addr = item.address || {};
    return {
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      district: addr.county || addr.state_district || addr.city || addr.town || null,
      state: addr.state || null,
    };
  });

  await redis.setex(cacheKey, SEARCH_CACHE_TTL, JSON.stringify(results));
  return results;
}
