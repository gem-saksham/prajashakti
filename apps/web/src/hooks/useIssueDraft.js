import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'prajashakti_issue_draft';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function defaultDraft() {
  return {
    draftId: generateId(),
    title: '',
    description: '',
    category: '',
    urgency: 'medium',
    location: null, // { lat, lng, district, state, pincode, displayName }
    ministryId: null,
    departmentId: null,
    departmentName: null,
    suggestedOfficialIds: [],
    photos: [], // { id, preview, name, size, type, exifGps, status, progress, file }
    savedAt: null,
  };
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    // Expire if > 24 hours old
    if (draft.savedAt && Date.now() - new Date(draft.savedAt).getTime() > DRAFT_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    // Photos can't be serialized — restore metadata only (no File objects)
    draft.photos = (draft.photos || []).map((p) => ({
      ...p,
      file: null,
      preview: null, // will be null since File is gone
      status: 'lost', // mark as needing re-upload
    }));
    return draft;
  } catch {
    return null;
  }
}

function serializeDraft(draft) {
  // Don't persist File objects or blob URLs — they don't survive serialization
  return {
    ...draft,
    photos: draft.photos.map(({ file, preview, ...rest }) => rest),
    savedAt: new Date().toISOString(),
  };
}

export function useIssueDraft() {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(() => {
    const saved = loadDraft();
    return saved || defaultDraft();
  });
  const [hasSavedDraft, setHasSavedDraft] = useState(() => !!loadDraft());
  const autoSaveRef = useRef(null);

  // Auto-save every 5 seconds
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      setDraft((d) => {
        if (d.title || d.description || d.location) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeDraft(d)));
        }
        return d;
      });
    }, 5000);
    return () => clearInterval(autoSaveRef.current);
  }, []);

  const updateDraft = useCallback((partial) => {
    setDraft((d) => ({ ...d, ...partial }));
  }, []);

  const saveDraft = useCallback(() => {
    setDraft((d) => {
      const saved = serializeDraft(d);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      return d;
    });
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
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
    // draft is already loaded from storage in useState initializer
  }, []);

  // Step validation
  const stepValid = {
    1: draft.title.length >= 10 && draft.description.length >= 20 && !!draft.category,
    2: !!draft.location?.lat,
    3: true, // department always optional
    4: true, // photos optional (warn but allow)
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
  };
}
