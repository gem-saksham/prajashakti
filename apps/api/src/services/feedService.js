/**
 * Feed Service — ranked issue feed for the home screen.
 *
 * Modes:
 *   trending — composite score: engagement + urgency + recency + trust
 *   nearby   — geo-filtered feed (requires lat/lng), sorted by score
 *   latest   — pure chronological, score still included for client use
 *   critical — urgency IN (critical, high), sorted by score
 *
 * No raw SQL here. All queries go through IssueModel.findFeed().
 * ServiceError(statusCode, code, message) for all business-rule failures.
 */

import * as IssueModel from '../models/issue.js';
import { ServiceError } from './userService.js';
import { isWithinIndia } from '../utils/locationValidator.js';
import { feedCacheKey, FEED_TTL } from '../utils/cacheKey.js';

export const FEED_MODES = ['trending', 'nearby', 'latest', 'critical'];

/**
 * Get the ranked feed.
 *
 * @param {Object} options
 * @param {string}  options.mode        — trending|nearby|latest|critical
 * @param {Object}  options.filters     — { category, urgency, state, district, isCampaign }
 * @param {number}  [options.lat]       — required for nearby
 * @param {number}  [options.lng]       — required for nearby
 * @param {number}  [options.radiusKm]  — default 20, max 100
 * @param {number}  [options.page]      — default 1
 * @param {number}  [options.limit]     — default 20, max 50
 * @param {object}  [redis]             — ioredis instance
 */
export async function getFeed(
  { mode = 'trending', filters = {}, lat, lng, radiusKm = 20, page = 1, limit = 20 },
  redis = null,
) {
  // ── Input validation ──────────────────────────────────────────────────────
  if (!FEED_MODES.includes(mode)) {
    throw new ServiceError(400, 'INVALID_MODE', `mode must be one of: ${FEED_MODES.join(', ')}`);
  }

  if (mode === 'nearby') {
    if (lat == null || lng == null) {
      throw new ServiceError(400, 'LAT_LNG_REQUIRED', 'lat and lng are required for nearby mode');
    }
    if (!isWithinIndia(lat, lng)) {
      throw new ServiceError(400, 'INVALID_LOCATION', 'Coordinates are outside India');
    }
    if (radiusKm < 1 || radiusKm > 100) {
      throw new ServiceError(400, 'INVALID_RADIUS', 'radius_km must be between 1 and 100');
    }
  }

  // ── Cache lookup ──────────────────────────────────────────────────────────
  // Cache key includes all active params so different queries don't collide.
  const cacheParams = {
    ...filters,
    ...(mode === 'nearby' ? { lat: lat.toFixed(4), lng: lng.toFixed(4), radiusKm } : {}),
  };
  const cacheKey = feedCacheKey(mode, cacheParams, page, limit);
  const ttl = FEED_TTL[mode] ?? 60;

  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  // ── Query ─────────────────────────────────────────────────────────────────
  const result = await IssueModel.findFeed({
    mode,
    filters,
    lat,
    lng,
    radiusKm,
    page,
    limit,
  });

  // ── Cache result ──────────────────────────────────────────────────────────
  if (redis) {
    redis.setex(cacheKey, ttl, JSON.stringify(result)).catch(() => {});
  }

  return result;
}

/**
 * Invalidate all feed cache entries.
 * Called after writes that affect feed ranking (new support, new issue).
 * Uses SCAN + DEL pattern to avoid blocking Redis with KEYS.
 *
 * @param {object} redis — ioredis instance
 */
export async function invalidateFeedCache(redis) {
  if (!redis) return;
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'feed:*', 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch {
    // Non-fatal — stale cache will expire naturally
  }
}
