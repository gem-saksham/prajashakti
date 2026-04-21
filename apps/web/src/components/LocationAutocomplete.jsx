import { useState, useEffect, useRef, useCallback } from 'react';
import { locationApi } from '../utils/api.js';
import Spinner from './Spinner.jsx';

/**
 * LocationAutocomplete — reusable location search with dropdown.
 *
 * Props:
 *   value       — display string for the selected location
 *   onChange    — ({ lat, lng, district, state, pincode, displayName }) => void
 *   onClear     — () => void — called when user clears the selection
 *   placeholder — string
 */
export default function LocationAutocomplete({
  value,
  onChange,
  onClear,
  placeholder = 'Search your location...',
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Debounced search
  const search = useCallback((q) => {
    clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await locationApi.search(q);
        setResults(data.results ?? []);
        setOpen(true);
        setHighlighted(-1);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 500);
  }, []);

  function handleInput(e) {
    const q = e.target.value;
    setQuery(q);
    search(q);
  }

  function handleSelect(result) {
    onChange({
      lat: result.lat,
      lng: result.lng,
      district: result.district,
      state: result.state,
      pincode: result.pincode ?? '',
      displayName: result.displayName,
    });
    setQuery('');
    setOpen(false);
    setResults([]);
  }

  function handleKeyDown(e) {
    if (!open || !results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault();
      handleSelect(results[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  async function handleGps() {
    setGpsError('');
    setGpsLoading(true);
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }),
      );
      const { latitude: lat, longitude: lng } = pos.coords;
      const data = await locationApi.reverse(lat, lng);
      onChange({
        lat,
        lng,
        district: data.location?.district || '',
        state: data.location?.state || '',
        pincode: data.location?.pincode || '',
        displayName: data.location?.formattedAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      });
      setOpen(false);
    } catch (err) {
      if (err?.code === 1) {
        setGpsError('Location access denied. Search manually.');
      } else {
        setGpsError('Could not detect location. Search manually.');
      }
    } finally {
      setGpsLoading(false);
    }
  }

  // If a value is already selected, show it as a pill
  if (value) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'rgba(20,137,122,0.1)',
            color: 'var(--color-teal)',
            borderRadius: 99,
            fontSize: 13,
            fontWeight: 600,
            maxWidth: '100%',
          }}
        >
          📍{' '}
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 220,
            }}
          >
            {value}
          </span>
          <button
            onClick={onClear}
            aria-label="Clear location"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              fontSize: 14,
              lineHeight: 1,
              padding: 0,
              marginLeft: 2,
            }}
          >
            ✕
          </button>
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Always-visible GPS button above the search box */}
      <button
        onClick={handleGps}
        disabled={gpsLoading}
        style={{
          width: '100%',
          padding: '11px 14px',
          background: 'rgba(20,137,122,0.06)',
          border: '1.5px solid rgba(20,137,122,0.2)',
          borderRadius: 10,
          textAlign: 'left',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-teal)',
          cursor: gpsLoading ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: 'inherit',
          marginBottom: 8,
        }}
      >
        {gpsLoading ? <Spinner size="small" /> : '📍'} Use my current location
      </button>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          border: '1.5px solid var(--color-border)',
          borderRadius: 12,
          background: 'var(--color-input-bg)',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            padding: '0 10px 0 14px',
            fontSize: 16,
            color: 'var(--color-text-muted)',
            flexShrink: 0,
          }}
        >
          🔍
        </span>
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length && setOpen(true)}
          placeholder={placeholder}
          aria-label="Search location"
          aria-autocomplete="list"
          aria-expanded={open}
          style={{
            flex: 1,
            padding: '13px 4px',
            border: 'none',
            background: 'transparent',
            fontSize: 14,
            fontFamily: 'inherit',
            color: 'var(--color-text-primary)',
            outline: 'none',
          }}
        />
        {loading && (
          <span style={{ padding: '0 12px 0 4px' }}>
            <Spinner size="small" />
          </span>
        )}
      </div>

      {/* GPS error */}
      {gpsError && (
        <p style={{ margin: '6px 0 0 2px', fontSize: 12, color: '#e05555' }}>{gpsError}</p>
      )}

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 200,
            overflow: 'hidden',
          }}
        >
          {/* Results */}
          {results.length === 0 && !loading && query.length >= 2 ? (
            <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--color-text-muted)' }}>
              No locations found for "{query}"
            </div>
          ) : (
            results.map((r, i) => (
              <button
                key={i}
                onClick={() => handleSelect(r)}
                onMouseEnter={() => setHighlighted(i)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  background: highlighted === i ? 'rgba(20,137,122,0.07)' : 'transparent',
                  border: 'none',
                  borderBottom: i < results.length - 1 ? '1px solid var(--color-border)' : 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {r.district && r.state
                    ? `${r.district}, ${r.state}`
                    : r.displayName.split(',').slice(0, 2).join(',')}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-muted)',
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.displayName}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
