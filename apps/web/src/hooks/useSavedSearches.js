/**
 * useSavedSearches — persist named filter sets in localStorage.
 *
 * Each saved search: { id, name, filters, createdAt }
 * Phase 3: sync to server for cross-device access.
 */
import { useState, useCallback } from 'react';

const STORAGE_KEY = 'ps_saved_searches';
const MAX_SAVED = 10;

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function persist(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

export function useSavedSearches() {
  const [saved, setSaved] = useState(load);

  const saveSearch = useCallback((name, filters) => {
    if (!name?.trim()) return;
    setSaved((prev) => {
      // Don't duplicate by name
      const deduped = prev.filter((s) => s.name !== name.trim());
      const next = [
        {
          id: Date.now().toString(36),
          name: name.trim(),
          filters,
          createdAt: new Date().toISOString(),
        },
        ...deduped,
      ].slice(0, MAX_SAVED);
      persist(next);
      return next;
    });
  }, []);

  const removeSearch = useCallback((id) => {
    setSaved((prev) => {
      const next = prev.filter((s) => s.id !== id);
      persist(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    persist([]);
    setSaved([]);
  }, []);

  return { saved, saveSearch, removeSearch, clearAll };
}
