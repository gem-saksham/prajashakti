/**
 * useIssueDraft — AsyncStorage-backed port of the web hook.
 *
 * Differences from web:
 *  - AsyncStorage is async, so hydration happens in useEffect (not useState initializer).
 *  - Consumers should wait on `hydrated` before trusting `draft` or `hasSavedDraft`.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'prajashakti_issue_draft';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function generateId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  );
}

function defaultDraft() {
  return {
    draftId: generateId(),
    title: '',
    description: '',
    category: '',
    urgency: 'medium',
    location: null,
    ministryId: null,
    departmentId: null,
    departmentName: null,
    suggestedOfficialIds: [],
    photos: [],
    savedAt: null,
  };
}

function serializeDraft(draft) {
  return {
    ...draft,
    photos: (draft.photos || []).map(({ file, preview, uri, ...rest }) => rest),
    savedAt: new Date().toISOString(),
  };
}

async function loadDraft() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (draft.savedAt && Date.now() - new Date(draft.savedAt).getTime() > DRAFT_TTL_MS) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    // Photo URIs/files don't survive across runs — mark any lingering entries as lost.
    draft.photos = (draft.photos || []).map((p) => ({
      ...p,
      file: null,
      preview: null,
      uri: null,
      status: 'lost',
    }));
    return draft;
  } catch {
    return null;
  }
}

export function useIssueDraft() {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(() => defaultDraft());
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const autoSaveRef = useRef(null);

  // Hydrate once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadDraft();
      if (cancelled) return;
      if (saved) {
        setDraft(saved);
        setHasSavedDraft(true);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-save every 5 seconds after hydration.
  useEffect(() => {
    if (!hydrated) return undefined;
    autoSaveRef.current = setInterval(() => {
      setDraft((d) => {
        if (d.title || d.description || d.location) {
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(serializeDraft(d))).catch(() => {});
        }
        return d;
      });
    }, 5000);
    return () => clearInterval(autoSaveRef.current);
  }, [hydrated]);

  const updateDraft = useCallback((partial) => {
    setDraft((d) => ({ ...d, ...partial }));
  }, []);

  const saveDraft = useCallback(() => {
    setDraft((d) => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(serializeDraft(d))).catch(() => {});
      return d;
    });
  }, []);

  const clearDraft = useCallback(() => {
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    setHasSavedDraft(false);
    setDraft(defaultDraft());
    setStep(1);
  }, []);

  const dismissSavedDraft = useCallback(() => {
    setHasSavedDraft(false);
    clearDraft();
  }, [clearDraft]);

  const resumeSavedDraft = useCallback(() => {
    setHasSavedDraft(false);
  }, []);

  // Step order (photo-first):
  //   1 = Capture (photos optional — always valid)
  //   2 = Describe (title + description + category)
  //   3 = Location (required)
  //   4 = Review (all valid if prior steps are)
  const stepValid = {
    1: true,
    2: draft.title.length >= 10 && draft.description.length >= 20 && !!draft.category,
    3: !!draft.location?.lat,
    4:
      draft.title.length >= 10 &&
      draft.description.length >= 20 &&
      !!draft.category &&
      !!draft.location?.lat,
  };

  return {
    step,
    setStep,
    draft,
    updateDraft,
    saveDraft,
    clearDraft,
    stepValid,
    hasSavedDraft,
    dismissSavedDraft,
    resumeSavedDraft,
    hydrated,
  };
}
