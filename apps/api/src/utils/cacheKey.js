/**
 * Cache key helpers for Redis.
 * Deterministic keys built from filter objects so the same
 * logical query always maps to the same key.
 */

import { createHash } from 'crypto';

/**
 * Stable SHA-256 hash of a filter object.
 * Keys are sorted before hashing so { a:1, b:2 } === { b:2, a:1 }.
 *
 * @param {Object} filters
 * @returns {string} 8-char hex prefix (collision-safe for our scale)
 */
export function filterHash(filters = {}) {
  const stable = Object.keys(filters)
    .sort()
    .reduce((acc, k) => {
      const v = filters[k];
      if (v !== undefined && v !== null && v !== '') {
        acc[k] = v;
      }
      return acc;
    }, {});

  return createHash('sha256').update(JSON.stringify(stable)).digest('hex').slice(0, 8);
}

/**
 * Redis key for a paginated issue list result.
 * Format: issues:list:{filterHash}:{page}:{limit}
 *
 * @param {Object} filters
 * @param {number} page
 * @param {number} limit
 * @returns {string}
 */
export function issueListCacheKey(filters, page, limit) {
  return `issues:list:${filterHash(filters)}:${page}:${limit}`;
}

/**
 * Redis key for a single issue.
 * Format: issues:single:{id}
 *
 * @param {string} id
 * @returns {string}
 */
export function issueCacheKey(id) {
  return `issues:single:${id}`;
}

/**
 * Redis key for issue stats.
 */
export const ISSUE_STATS_KEY = 'issues:stats';

/**
 * Redis key prefix for government taxonomy (long-lived, 24 h TTL).
 */
export const GOV_CACHE_PREFIX = 'gov';

export function govCacheKey(...parts) {
  return [GOV_CACHE_PREFIX, ...parts].join(':');
}

/**
 * Redis key for a ranked feed result.
 * Format: feed:{mode}:{filterHash}:{page}:{limit}
 *
 * @param {string} mode    — trending|nearby|latest|critical
 * @param {Object} filters — active filter params (including lat/lng for nearby)
 * @param {number} page
 * @param {number} limit
 * @returns {string}
 */
export function feedCacheKey(mode, filters, page, limit) {
  return `feed:${mode}:${filterHash(filters)}:${page}:${limit}`;
}

/** TTLs (seconds) per feed mode — trending changes fastest */
export const FEED_TTL = {
  trending: 30,
  nearby: 45,
  latest: 60,
  critical: 60,
};
