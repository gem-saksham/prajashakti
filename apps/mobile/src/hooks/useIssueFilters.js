/**
 * useIssueFilters — mobile filter state (in-memory; no URL on RN).
 * Mirrors the web `useUrlFilters` API so screens stay consistent.
 */
import { useState, useCallback } from 'react';

export const FILTER_DEFAULTS = {
  search: '',
  category: '',
  urgency: '',
  status: '',
  state: '',
  district: '',
  sort: 'newest',
  minSupport: 0,
  dateRange: 'all',
  hasPhotos: false,
  verifiedOnly: false,
  lat: null,
  lng: null,
  radiusKm: 10,
};

/** Map camelCase filter keys to API query param names (same as web). */
export function toApiParams(filters) {
  const p = {};
  if (filters.search) p.search = filters.search;
  if (filters.category) p.category = filters.category;
  if (filters.urgency) p.urgency = filters.urgency;
  if (filters.status) p.status = filters.status;
  if (filters.state) p.state = filters.state;
  if (filters.district) p.district = filters.district;
  if (filters.sort) p.sort = filters.sort;
  if (filters.minSupport > 0) p.min_support = filters.minSupport;
  if (filters.dateRange && filters.dateRange !== 'all') p.date_range = filters.dateRange;
  if (filters.hasPhotos) p.has_photos = true;
  if (filters.verifiedOnly) p.verified_only = true;
  if (filters.lat != null && filters.lng != null) {
    p.lat = filters.lat;
    p.lng = filters.lng;
    p.radius_km = filters.radiusKm || 10;
  }
  return p;
}

export function useIssueFilters(initial = FILTER_DEFAULTS) {
  const [filters, setFilters] = useState(initial);

  const updateFilters = useCallback((updates) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(FILTER_DEFAULTS);
  }, []);

  const activeCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'sort' && v === 'newest') return false;
    if (k === 'dateRange' && v === 'all') return false;
    if (k === 'minSupport' && v === 0) return false;
    if (k === 'lng') return false;
    if (k === 'radiusKm') return false;
    return v !== null && v !== false && v !== '' && v !== 0;
  }).length;

  return { filters, updateFilters, clearFilters, activeCount };
}
