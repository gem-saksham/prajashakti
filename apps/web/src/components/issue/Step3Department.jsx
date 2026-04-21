import { useState, useEffect, useRef } from 'react';
import { issueApi, officialApi } from '../../utils/api.js';
import Spinner from '../Spinner.jsx';

export default function Step3Department({ draft, onUpdate }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [officialSearch, setOfficialSearch] = useState('');
  const [officialResults, setOfficialResults] = useState([]);
  const [officialLoading, setOfficialLoading] = useState(false);
  const [selectedOfficials, setSelectedOfficials] = useState([]);
  const officialDebounce = useRef(null);
  const fetchedRef = useRef(false);

  // Fetch suggestions once on mount
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    if (!draft.title || draft.title.length < 5) return;

    setLoading(true);
    setError('');
    issueApi
      .suggestTags({
        title: draft.title,
        description: draft.description || draft.title,
        category: draft.category,
        location_lat: draft.location?.lat,
        location_lng: draft.location?.lng,
      })
      .then((res) => {
        // Response: { success, suggestions: { ministries, departments, ... } }
        const { departments = [], ministries = [] } = res.suggestions || {};

        // Build display cards: prefer departments (they include ministry context),
        // fall back to raw ministries if no departments returned.
        let cards = departments.slice(0, 3).map((d) => ({
          ministryId: d.ministry?.id || null,
          ministryName: d.ministry?.name || null,
          departmentId: d.id,
          departmentName: d.name,
          confidence: null,
          reason: d.reason,
        }));

        if (cards.length === 0 && ministries.length > 0) {
          cards = ministries.slice(0, 3).map((m) => ({
            ministryId: m.id,
            ministryName: m.name,
            departmentId: null,
            departmentName: null,
            confidence: null,
            reason: m.reason,
          }));
        }

        if (cards.length > 0) {
          setSuggestions(cards);
          // Auto-select first suggestion if nothing selected yet
          if (!draft.ministryId && cards[0]) {
            onUpdate({
              ministryId: cards[0].ministryId,
              departmentId: cards[0].departmentId,
              departmentName: cards[0].departmentName || cards[0].ministryName,
            });
          }
        }
      })
      .catch(() => {
        setError('Could not load suggestions. You can select manually below.');
        setShowManual(true);
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  function handleSelectSuggestion(tag) {
    onUpdate({
      ministryId: tag.ministryId,
      departmentId: tag.departmentId,
      departmentName: tag.departmentName || tag.ministryName,
    });
    setShowManual(false);
  }

  function handleNoneOfThese() {
    setShowManual(true);
    onUpdate({ ministryId: null, departmentId: null, departmentName: null });
  }

  // Official search with debounce
  useEffect(() => {
    clearTimeout(officialDebounce.current);
    if (officialSearch.trim().length < 2) {
      setOfficialResults([]);
      return;
    }
    officialDebounce.current = setTimeout(async () => {
      setOfficialLoading(true);
      try {
        const res = await officialApi.search(officialSearch, draft.location?.state);
        setOfficialResults(res.data?.slice(0, 5) || []);
      } catch {
        setOfficialResults([]);
      } finally {
        setOfficialLoading(false);
      }
    }, 400);
  }, [officialSearch, draft.location?.state]);

  function addOfficial(official) {
    if (selectedOfficials.length >= 3) return;
    if (selectedOfficials.find((o) => o.id === official.id)) return;
    const updated = [...selectedOfficials, official];
    setSelectedOfficials(updated);
    onUpdate({ suggestedOfficialIds: updated.map((o) => o.id) });
    setOfficialSearch('');
    setOfficialResults([]);
  }

  function removeOfficial(id) {
    const updated = selectedOfficials.filter((o) => o.id !== id);
    setSelectedOfficials(updated);
    onUpdate({ suggestedOfficialIds: updated.map((o) => o.id) });
  }

  const selectedId = draft.departmentId || draft.ministryId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Info banner */}
      <div
        style={{
          background: 'rgba(20,137,122,0.07)',
          borderRadius: 10,
          padding: '10px 14px',
          fontSize: 13,
          color: '#14897A',
          lineHeight: 1.5,
        }}
      >
        🏛️ When this issue gets enough support, we'll help you file an official complaint with the
        right department.
      </div>

      {/* Suggested departments */}
      <div>
        <label
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#1a1a1a',
            display: 'block',
            marginBottom: 10,
          }}
        >
          Responsible Department
          <span style={{ fontSize: 12, fontWeight: 500, color: '#888', marginLeft: 6 }}>
            optional
          </span>
        </label>

        {loading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '16px 0',
              color: '#888',
            }}
          >
            <Spinner size="small" />
            <span style={{ fontSize: 13 }}>Finding the right department...</span>
          </div>
        )}

        {!loading && suggestions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {suggestions.map((tag, i) => {
              const tagId = tag.departmentId || tag.ministryId;
              const isSelected = selectedId === tagId;
              const reasonText = tag.reason ? tag.reason.replace(/_/g, ' ') : null;
              return (
                <button
                  key={i}
                  onClick={() => handleSelectSuggestion(tag)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: `1.5px solid ${isSelected ? '#14897A' : 'rgba(0,0,0,0.1)'}`,
                    background: isSelected ? 'rgba(20,137,122,0.06)' : '#fff',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 24, flexShrink: 0 }}>🏛️</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
                      {tag.ministryName || tag.departmentName}
                    </div>
                    {tag.departmentName && tag.ministryName && (
                      <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                        {tag.departmentName}
                      </div>
                    )}
                    {reasonText && (
                      <div
                        style={{
                          fontSize: 11,
                          color: '#14897A',
                          fontWeight: 600,
                          marginTop: 3,
                          textTransform: 'capitalize',
                        }}
                      >
                        {reasonText}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: '#14897A',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}

            <button
              onClick={handleNoneOfThese}
              style={{
                padding: '11px 16px',
                borderRadius: 12,
                border: '1.5px solid rgba(0,0,0,0.08)',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
                color: '#888',
                textAlign: 'left',
                fontWeight: 500,
              }}
            >
              None of these — let me search manually
            </button>
          </div>
        )}

        {!loading && suggestions.length === 0 && !error && (
          <div style={{ color: '#888', fontSize: 14, padding: '8px 0' }}>
            No suggestions available.
            <button
              onClick={() => setShowManual(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#14897A',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 14,
                fontWeight: 600,
                marginLeft: 6,
                textDecoration: 'underline',
              }}
            >
              Select manually
            </button>
          </div>
        )}

        {error && <div style={{ fontSize: 13, color: '#c0392b', padding: '4px 0' }}>{error}</div>}

        {showManual && (
          <div style={{ marginTop: 8 }}>
            <input
              type="text"
              placeholder="Type a ministry or department name..."
              value={draft.departmentName || ''}
              onChange={(e) =>
                onUpdate({ departmentName: e.target.value, ministryId: null, departmentId: null })
              }
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1.5px solid rgba(0,0,0,0.12)',
                borderRadius: 10,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                background: '#f8f8f6',
              }}
            />
            <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              This is for reference only. Official routing uses the CPGRAMS taxonomy.
            </p>
          </div>
        )}
      </div>

      {/* Official tagging */}
      <div>
        <label
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#1a1a1a',
            display: 'block',
            marginBottom: 8,
          }}
        >
          Tag a specific official
          <span style={{ fontSize: 12, fontWeight: 500, color: '#888', marginLeft: 6 }}>
            optional · max 3
          </span>
        </label>

        {/* Selected officials */}
        {selectedOfficials.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {selectedOfficials.map((o) => (
              <span
                key={o.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px 6px 8px',
                  background: 'rgba(13,79,79,0.07)',
                  borderRadius: 99,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#0D4F4F',
                }}
              >
                {o.name}
                <button
                  onClick={() => removeOfficial(o.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'inherit',
                    fontSize: 14,
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        {selectedOfficials.length < 3 && (
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search by name or designation..."
              value={officialSearch}
              onChange={(e) => setOfficialSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '11px 14px',
                border: '1.5px solid rgba(0,0,0,0.12)',
                borderRadius: 10,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                background: '#f8f8f6',
              }}
            />
            {officialLoading && (
              <div
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              >
                <Spinner size="small" />
              </div>
            )}
            {officialResults.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 4,
                  background: '#fff',
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                  zIndex: 100,
                  overflow: 'hidden',
                }}
              >
                {officialResults.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => addOfficial(o)}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid rgba(0,0,0,0.06)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{o.name}</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                      {o.designation}
                      {o.jurisdictionDistrict ? ` · ${o.jurisdictionDistrict}` : ''}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
