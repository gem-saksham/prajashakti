/**
 * IssueSearchBar — search input with autocomplete dropdown.
 *
 * Dropdown sections (while typing):
 *   • Locations  — states / districts matching the query
 *   • Popular    — popular past queries
 *   • Issues     — top 3 FTS-matched issue titles
 *
 * Recent searches shown when input is focused but empty.
 * Saved searches listed below recent searches.
 *
 * Keyboard: ↑/↓ navigate, Enter selects, Esc closes.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { searchApi } from '../../utils/api.js';

const MAX_RECENT = 5;
const RECENT_KEY = 'ps_recent_searches';
const DEBOUNCE_MS = 400;

// ── localStorage helpers ──────────────────────────────────────────────────────

function getRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecent(q) {
  if (!q.trim()) return;
  const prev = getRecent().filter((s) => s !== q.trim());
  localStorage.setItem(RECENT_KEY, JSON.stringify([q.trim(), ...prev].slice(0, MAX_RECENT)));
}

// ── Flat navigation list builder ──────────────────────────────────────────────

function buildNavItems(suggestions, recent, saved) {
  if (suggestions) {
    const items = [];
    (suggestions.locations || []).forEach((l) =>
      items.push({ type: 'location', value: l.name, label: l.name, sub: l.type }),
    );
    (suggestions.queries || []).forEach((q) => items.push({ type: 'query', value: q, label: q }));
    (suggestions.issues || []).forEach((i) =>
      items.push({ type: 'issue', value: i.title, label: i.title, sub: i.location_district || '' }),
    );
    return items;
  }
  const items = [];
  recent.forEach((q) => items.push({ type: 'recent', value: q, label: q }));
  saved.forEach((s) =>
    items.push({ type: 'saved', value: s.name, label: s.name, savedId: s.id, filters: s.filters }),
  );
  return items;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function IssueSearchBar({ value, onChange, savedSearches = [], onLoadSavedSearch }) {
  const [draft, setDraft] = useState(value || '');
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState(null); // null = not fetched yet
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [recent, setRecent] = useState(getRecent);

  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Sync external clear (e.g. "clear all filters")
  useEffect(() => {
    if (value !== draft) {
      setDraft(value || '');
      setSuggestions(null);
    }
  }, [value]); // eslint-disable-line

  // Fetch suggestions when draft changes
  useEffect(() => {
    clearTimeout(debounceRef.current);
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

  const navItems = buildNavItems(draft.trim() ? suggestions : null, recent, savedSearches);

  const showDropdown =
    focused &&
    (draft.trim() ? loading || navItems.length > 0 : recent.length > 0 || savedSearches.length > 0);

  // Reset active index when dropdown contents change
  useEffect(() => {
    setActiveIdx(-1);
  }, [navItems.length, draft]);

  function commit(searchValue) {
    clearTimeout(debounceRef.current);
    onChange(searchValue);
    if (searchValue.trim()) {
      saveRecent(searchValue.trim());
      setRecent(getRecent());
    }
    setFocused(false);
    setSuggestions(null);
  }

  function handleChange(e) {
    setDraft(e.target.value);
    // Propagate immediately for "typing" feel; debounced API call above
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(e.target.value);
      if (e.target.value.trim()) {
        saveRecent(e.target.value.trim());
        setRecent(getRecent());
      }
    }, DEBOUNCE_MS);
  }

  function handleClear() {
    setDraft('');
    onChange('');
    setSuggestions(null);
    inputRef.current?.focus();
  }

  function handleSubmit(e) {
    e.preventDefault();
    commit(draft);
  }

  function handleSelectItem(item) {
    if (item.type === 'saved' && item.filters) {
      onLoadSavedSearch?.(item.filters);
      setDraft('');
      setFocused(false);
      setSuggestions(null);
      return;
    }
    setDraft(item.value);
    commit(item.value);
  }

  function handleKeyDown(e) {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, navItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      handleSelectItem(navItems[activeIdx]);
    } else if (e.key === 'Escape') {
      setFocused(false);
      setSuggestions(null);
    }
  }

  // Section header helper
  function SectionHeader({ title }) {
    return (
      <div
        style={{
          padding: '8px 14px 3px',
          fontSize: 10,
          fontWeight: 700,
          color: '#aaa',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </div>
    );
  }

  // Render dropdown items grouped by type
  function renderDropdown() {
    if (loading) {
      return (
        <div style={{ padding: '14px 16px', fontSize: 13, color: '#aaa', textAlign: 'center' }}>
          Searching…
        </div>
      );
    }

    if (draft.trim() && suggestions) {
      const locations = suggestions.locations || [];
      const queries = suggestions.queries || [];
      const issues = suggestions.issues || [];

      if (locations.length === 0 && queries.length === 0 && issues.length === 0) {
        return (
          <div style={{ padding: '14px 16px', fontSize: 13, color: '#aaa' }}>
            No suggestions found
          </div>
        );
      }

      let flatIdx = 0;
      const sections = [];

      if (locations.length > 0) {
        sections.push(<SectionHeader key="loc-h" title="Locations" />);
        locations.forEach((loc) => {
          const idx = flatIdx++;
          sections.push(
            <DropdownItem
              key={`loc-${loc.name}`}
              icon="📍"
              label={loc.name}
              sub={loc.type}
              active={activeIdx === idx}
              onMouseDown={() => handleSelectItem({ type: 'location', value: loc.name })}
              onMouseEnter={() => setActiveIdx(idx)}
            />,
          );
        });
      }

      if (queries.length > 0) {
        sections.push(<SectionHeader key="pop-h" title="Popular searches" />);
        queries.forEach((q) => {
          const idx = flatIdx++;
          sections.push(
            <DropdownItem
              key={`q-${q}`}
              icon="🔥"
              label={q}
              active={activeIdx === idx}
              onMouseDown={() => handleSelectItem({ type: 'query', value: q })}
              onMouseEnter={() => setActiveIdx(idx)}
            />,
          );
        });
      }

      if (issues.length > 0) {
        sections.push(<SectionHeader key="iss-h" title="Matching issues" />);
        issues.forEach((issue) => {
          const idx = flatIdx++;
          sections.push(
            <DropdownItem
              key={`iss-${issue.id || issue.title}`}
              icon="📢"
              label={issue.title}
              sub={issue.location_district}
              active={activeIdx === idx}
              onMouseDown={() => handleSelectItem({ type: 'issue', value: issue.title })}
              onMouseEnter={() => setActiveIdx(idx)}
            />,
          );
        });
      }

      return sections;
    }

    // Empty input — show recent + saved
    let flatIdx = 0;
    const sections = [];

    if (recent.length > 0) {
      sections.push(<SectionHeader key="rec-h" title="Recent searches" />);
      recent.forEach((q) => {
        const idx = flatIdx++;
        sections.push(
          <DropdownItem
            key={`rec-${q}`}
            icon="🕐"
            label={q}
            active={activeIdx === idx}
            onMouseDown={() => handleSelectItem({ type: 'recent', value: q })}
            onMouseEnter={() => setActiveIdx(idx)}
          />,
        );
      });
    }

    if (savedSearches.length > 0) {
      sections.push(<SectionHeader key="sav-h" title="Saved searches" />);
      savedSearches.forEach((s) => {
        const idx = flatIdx++;
        sections.push(
          <DropdownItem
            key={`sav-${s.id}`}
            icon="💾"
            label={s.name}
            active={activeIdx === idx}
            onMouseDown={() =>
              handleSelectItem({ type: 'saved', value: s.name, filters: s.filters })
            }
            onMouseEnter={() => setActiveIdx(idx)}
          />,
        );
      });
    }

    return sections;
  }

  return (
    <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: '#fff',
          border: `1.5px solid ${focused ? '#14897A' : 'rgba(0,0,0,0.12)'}`,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: focused ? '0 0 0 3px rgba(20,137,122,0.1)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        <span style={{ padding: '0 8px 0 14px', fontSize: 16, color: '#888', flexShrink: 0 }}>
          🔍
        </span>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder="Search issues by title, location, or department..."
          style={{
            flex: 1,
            padding: '12px 4px',
            border: 'none',
            background: 'transparent',
            fontSize: 14,
            fontFamily: 'inherit',
            color: '#1a1a1a',
            outline: 'none',
          }}
        />
        {loading && (
          <span style={{ padding: '0 10px', color: '#aaa', fontSize: 12, flexShrink: 0 }}>…</span>
        )}
        {draft && !loading && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              padding: '0 14px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#aaa',
              fontSize: 16,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 12,
            boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
            zIndex: 200,
            overflow: 'hidden',
            maxHeight: 380,
            overflowY: 'auto',
          }}
        >
          {renderDropdown()}
        </div>
      )}
    </form>
  );
}

// ── Shared dropdown row ───────────────────────────────────────────────────────

function DropdownItem({ icon, label, sub, active, onMouseDown, onMouseEnter }) {
  return (
    <button
      type="button"
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      style={{
        width: '100%',
        padding: '9px 14px',
        background: active ? 'rgba(13,79,79,0.06)' : 'none',
        border: 'none',
        borderTop: '1px solid rgba(0,0,0,0.04)',
        textAlign: 'left',
        fontSize: 13,
        color: '#1a1a1a',
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        transition: 'background 0.08s',
      }}
    >
      <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {sub && <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>{sub}</span>}
    </button>
  );
}
