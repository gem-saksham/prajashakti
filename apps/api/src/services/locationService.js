/**
 * Location Service — IP detection, reverse geocoding, forward search,
 * jurisdiction lookup, and responsible department resolution.
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

import { normalizeStateName, stateNameToCode } from '../utils/locationValidator.js';
import * as LocationModel from '../models/location.js';
import * as GovModel from '../models/government.js';

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

// ─── Jurisdiction Lookup ──────────────────────────────────────────────────────

/**
 * Resolve a lat/lng to administrative jurisdiction:
 * country, state (with code + LGD code), district (with code + LGD code),
 * sub-district, and pincode.
 *
 * Combines Nominatim reverse geocode with our internal states/districts tables
 * to provide LGD codes and canonical codes.
 *
 * Cached for 24 hours (same cache as reverseGeocode, but richer payload).
 *
 * @param {object} redis
 * @param {number} lat
 * @param {number} lng
 * @returns {{ country, state, stateCode, stateLgdCode, district, districtCode, districtLgdCode, subDistrict, pincode, formattedAddress }}
 */
export async function getJurisdiction(redis, lat, lng) {
  const latR = parseFloat(lat).toFixed(3);
  const lngR = parseFloat(lng).toFixed(3);
  const cacheKey = `juri:${latR}:${lngR}`;

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const data = await nominatimFetch(
    `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
  );

  const addr = data.address || {};

  // Nominatim returns state as full name; normalise to canonical + look up code
  const rawState = addr.state || null;
  const canonicalState = rawState ? normalizeStateName(rawState) : null;
  const stateCode = canonicalState ? stateNameToCode(canonicalState) : null;

  // District from Nominatim (county/state_district/city)
  const rawDistrict =
    addr.county || addr.state_district || addr.city || addr.town || addr.village || null;

  // Enrich with DB records to get LGD codes and canonical district codes
  let stateRecord = null;
  let districtRecord = null;

  if (stateCode) {
    stateRecord = await LocationModel.getStateByCode(stateCode);
    if (stateRecord && rawDistrict) {
      districtRecord = await LocationModel.findDistrictByName(stateCode, rawDistrict);
    }
  }

  const result = {
    country: addr.country || 'India',
    countryCode: addr.country_code?.toUpperCase() || 'IN',
    state: canonicalState || rawState,
    stateCode: stateRecord?.code || stateCode || null,
    stateLgdCode: stateRecord?.lgdCode || null,
    district: districtRecord?.name || rawDistrict,
    districtCode: districtRecord?.code || null,
    districtLgdCode: districtRecord?.lgdCode || null,
    subDistrict: addr.suburb || addr.neighbourhood || addr.village || null,
    pincode: addr.postcode || null,
    formattedAddress: data.display_name || null,
  };

  await redis.setex(cacheKey, GEO_CACHE_TTL, JSON.stringify(result));
  return result;
}

// ─── Responsible Department Resolution ───────────────────────────────────────

/**
 * Find responsible departments for a given location and issue category.
 *
 * Priority order (highest to lowest):
 *  1. District-level departments matching the jurisdiction
 *  2. State-level departments matching the state
 *  3. National/central departments for this category
 *
 * @param {object} redis
 * @param {number} lat
 * @param {number} lng
 * @param {string} prajaCategory  — PrajaShakti category slug (e.g. 'roads', 'water')
 * @returns {Array<{ department, ministry, jurisdictionLevel: 'district'|'state'|'national' }>}
 */
export async function findResponsibleDepartments(redis, lat, lng, prajaCategory) {
  const jurisdiction = await getJurisdiction(redis, lat, lng);
  const cacheKey = `resp:${jurisdiction.stateCode || 'XX'}:${jurisdiction.districtCode || 'XX'}:${prajaCategory}`;

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const results = [];

  // 1. District-level departments
  if (jurisdiction.districtCode) {
    const districtDepts = await GovModel.listDepartmentsByJurisdiction(
      'district',
      jurisdiction.districtCode,
    );
    for (const dept of districtDepts) {
      results.push({ department: dept, jurisdictionLevel: 'district' });
    }
  }

  // 2. State-level departments
  if (jurisdiction.stateCode) {
    const stateDepts = await GovModel.listDepartmentsByJurisdiction(
      'state',
      jurisdiction.stateCode,
    );
    for (const dept of stateDepts) {
      results.push({ department: dept, jurisdictionLevel: 'state' });
    }
  }

  // 3. National departments for this category
  if (prajaCategory) {
    const categories = await GovModel.listGrievanceCategories(prajaCategory);
    for (const cat of categories) {
      if (cat.defaultDepartment) {
        const dept = await GovModel.getDepartmentById(cat.defaultDepartmentId);
        if (dept && !results.find((r) => r.department.id === dept.id)) {
          results.push({ department: dept, jurisdictionLevel: 'national' });
        }
      }
    }
  }

  // Cache for 1 hour
  await redis.setex(cacheKey, 3600, JSON.stringify(results));
  return results;
}
