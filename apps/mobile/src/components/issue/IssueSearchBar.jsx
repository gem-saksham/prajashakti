/**
 * IssueSearchBar (mobile) — search input with autocomplete dropdown.
 *
 * Mirrors the web IssueSearchBar:
 *  - Debounced suggestions via `searchApi.suggest`
 *  - Recent searches (AsyncStorage) shown when empty
 *  - Tap to commit
 *
 * Advanced features left out for mobile-first UX: keyboard arrow navigation,
 * saved searches list (can come later via ActionSheet).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONTS, RADIUS } from '../../theme';
import { searchApi } from '../../utils/api';

const MAX_RECENT = 5;
const RECENT_KEY = 'ps_recent_searches';
const DEBOUNCE_MS = 400;

async function getRecent() {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function pushRecent(q) {
  if (!q?.trim()) return;
  const prev = (await getRecent()).filter((s) => s !== q.trim());
  const next = [q.trim(), ...prev].slice(0, MAX_RECENT);
  try {
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export default function IssueSearchBar({ value, onChange }) {
  const [draft, setDraft] = useState(value || '');
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState([]);

  const debounceRef = useRef(null);

  // Hydrate recent searches once
  useEffect(() => {
    getRecent().then(setRecent);
  }, []);

  // Sync external clear
  useEffect(() => {
    if (value !== draft) {
      setDraft(value || '');
      setSuggestions(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Debounced API call when `draft` changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!draft.trim()) {
      setSuggestions(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchApi.suggest(draft.trim(), 5);
        setSuggestions(data.suggestions ?? data);
      } catch {
        setSuggestions(null);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [draft]);

  const showDropdown =
    focused &&
    (draft.trim()
      ? loading || (suggestions && Object.values(suggestions).some((a) => a?.length > 0))
      : recent.length > 0);

  const commit = useCallback(
    async (searchValue) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      onChange(searchValue);
      if (searchValue?.trim()) {
        const next = await pushRecent(searchValue);
        if (next) setRecent(next);
      }
      setFocused(false);
      setSuggestions(null);
      Keyboard.dismiss();
    },
    [onChange],
  );

  function handleSubmit() {
    commit(draft);
  }

  function handleClear() {
    setDraft('');
    onChange('');
    setSuggestions(null);
  }

  function handleSelect(value) {
    setDraft(value);
    commit(value);
  }

  return (
    <View style={{ position: 'relative', flex: 1 }}>
      <View style={[styles.inputRow, focused && styles.inputRowFocused]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={draft}
          onChangeText={(t) => {
            setDraft(t);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
              onChange(t);
              if (t.trim()) pushRecent(t).then((next) => next && setRecent(next));
            }, DEBOUNCE_MS);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 180)}
          onSubmitEditing={handleSubmit}
          placeholder="Search issues by title, location, department…"
          placeholderTextColor="#aaa"
          returnKeyType="search"
          style={styles.input}
        />
        {loading ? (
          <ActivityIndicator size="small" color="#aaa" style={{ marginRight: 6 }} />
        ) : null}
        {draft && !loading ? (
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {showDropdown ? (
        <ScrollView
          style={styles.dropdown}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {draft.trim() && suggestions ? (
            <Suggestions suggestions={suggestions} onSelect={handleSelect} loading={loading} />
          ) : (
            <RecentList recent={recent} onSelect={handleSelect} />
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

function SectionHeader({ title }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function Row({ icon, label, sub, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.6} onPress={onPress} style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      {sub ? (
        <Text style={styles.rowSub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

function Suggestions({ suggestions, onSelect, loading }) {
  const locations = suggestions.locations || [];
  const queries = suggestions.queries || [];
  const issues = suggestions.issues || [];

  if (loading) {
    return <Text style={styles.emptyText}>Searching…</Text>;
  }
  if (!locations.length && !queries.length && !issues.length) {
    return <Text style={styles.emptyText}>No suggestions found</Text>;
  }

  return (
    <>
      {locations.length > 0 ? (
        <>
          <SectionHeader title="Locations" />
          {locations.map((loc) => (
            <Row
              key={`loc-${loc.name}`}
              icon="📍"
              label={loc.name}
              sub={loc.type}
              onPress={() => onSelect(loc.name)}
            />
          ))}
        </>
      ) : null}
      {queries.length > 0 ? (
        <>
          <SectionHeader title="Popular searches" />
          {queries.map((q) => (
            <Row key={`q-${q}`} icon="🔥" label={q} onPress={() => onSelect(q)} />
          ))}
        </>
      ) : null}
      {issues.length > 0 ? (
        <>
          <SectionHeader title="Matching issues" />
          {issues.map((i) => (
            <Row
              key={`iss-${i.id ?? i.title}`}
              icon="📢"
              label={i.title}
              sub={i.location_district}
              onPress={() => onSelect(i.title)}
            />
          ))}
        </>
      ) : null}
    </>
  );
}

function RecentList({ recent, onSelect }) {
  return (
    <>
      <SectionHeader title="Recent searches" />
      {recent.map((q) => (
        <Row key={`rec-${q}`} icon="🕐" label={q} onPress={() => onSelect(q)} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: RADIUS.md,
    height: 40,
  },
  inputRowFocused: { borderColor: COLORS.teal },
  searchIcon: { paddingHorizontal: 10, fontSize: 16, color: '#888' },
  input: {
    flex: 1,
    paddingVertical: 0,
    paddingRight: 8,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  clearText: { fontSize: 14, color: '#aaa' },

  dropdown: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: RADIUS.md,
    maxHeight: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 200,
  },
  sectionHeader: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 3,
    fontSize: 10,
    fontWeight: FONTS.weight.bold,
    color: '#aaa',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  rowIcon: { fontSize: 14 },
  rowLabel: { flex: 1, fontSize: 13, color: COLORS.textPrimary },
  rowSub: { fontSize: 11, color: '#aaa' },
  emptyText: { padding: 14, fontSize: 13, color: '#aaa', textAlign: 'center' },
});
