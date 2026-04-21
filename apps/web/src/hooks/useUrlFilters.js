/**
 * useUrlFilters — all filter state lives in the URL.
 *
 * Day 26: minSupport, dateRange, hasPhotos, verifiedOnly, lat/lng/radiusKm.
 *
 * Design:
 *  - `replaceState` for rapid changes (typing search) — doesn't spam history
 *  - Omit default values from URL so links stay clean
 *  - Parse on mount so copy-pasted URLs immediately restore filter state
 */
import { useState, useCallback, useRef } from 'react';

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

function parseParams() {
  const p = new URLSearchParams(window.location.search);
  const lat = p.get('lat') ? parseFloat(p.get('lat')) : null;
  const lng = p.get('lng') ? parseFloat(p.get('lng')) : null;
  return {
    search: p.get('search') || '',
    category: p.get('category') || '',
    urgency: p.get('urgency') || '',
    status: p.get('status') || '',
    state: p.get('state') || '',
    district: p.get('district') || '',
    sort: p.get('sort') || 'newest',
    minSupport: parseInt(p.get('min_support') || '0', 10),
    dateRange: p.get('date_range') || 'all',
    hasPhotos: p.get('has_photos') === 'true',
    verifiedOnly: p.get('verified_only') === 'true',
    lat,
    lng,
    radiusKm: p.get('radius_km') ? parseFloat(p.get('radius_km')) : 10,
  };
}

function toUrlParams(filters) {
  const p = new URLSearchParams();
  if (filters.search) p.set('search', filters.search);
  if (filters.category) p.set('category', filters.category);
  if (filters.urgency) p.set('urgency', filters.urgency);
  if (filters.status) p.set('status', filters.status);
  if (filters.state) p.set('state', filters.state);
  if (filters.district) p.set('district', filters.district);
  if (filters.sort && filters.sort !== 'newest') p.set('sort', filters.sort);
  if (filters.minSupport > 0) p.set('min_support', filters.minSupport);
  if (filters.dateRange && filters.dateRange !== 'all') p.set('date_range', filters.dateRange);
  if (filters.hasPhotos) p.set('has_photos', 'true');
  if (filters.verifiedOnly) p.set('verified_only', 'true');
  if (filters.lat != null && filters.lng != null) {
    p.set('lat', filters.lat.toFixed(6));
    p.set('lng', filters.lng.toFixed(6));
    if (filters.radiusKm && filters.radiusKm !== 10) p.set('radius_km', filters.radiusKm);
  }
  return p.toString();
}

/** Map camelCase filter keys to API query param names */
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

export function useUrlFilters() {
  const [filters, setFilters] = useState(parseParams);
  const pushRef = useRef(false);

  const updateFilters = useCallback((updates, { pushHistory = false } = {}) => {
    setFilters((prev) => {
      const next = { ...prev, ...updates };
      const qs = toUrlParams(next);
      const url = qs ? `?${qs}` : window.location.pathname;
      if (pushHistory || pushRef.current) {
        window.history.pushState(null, '', url);
      } else {
        window.history.replaceState(null, '', url);
      }
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    window.history.pushState(null, '', window.location.pathname);
    setFilters(FILTER_DEFAULTS);
  }, []);

  const activeCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'sort' && v === 'newest') return false;
    if (k === 'dateRange' && v === 'all') return false;
    if (k === 'minSupport' && v === 0) return false;
    // geo counts as one filter unit via lat; lng and radiusKm don't add separately
    if (k === 'lng') return false;
    if (k === 'radiusKm') return false;
    return v !== null && v !== false && v !== '' && v !== 0;
  }).length;

  return { filters, updateFilters, clearFilters, activeCount };
}
