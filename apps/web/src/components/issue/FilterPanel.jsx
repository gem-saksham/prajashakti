import { useState, useEffect } from 'react';

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
];

const RADIUS_PRESETS = [1, 5, 10, 25, 50];

export default function FilterPanel({ filters, onUpdate, onClear }) {
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');

  useEffect(() => {
    setStatesLoading(true);
    fetch('/api/v1/location/states')
      .then((r) => r.json())
      .then((d) => setStates(d.states || []))
      .catch(() => {})
      .finally(() => setStatesLoading(false));
  }, []);

  useEffect(() => {
    if (!filters.state) {
      setDistricts([]);
      return;
    }
    const stateObj = states.find((s) => s.name === filters.state || s.code === filters.state);
    if (!stateObj) return;
    fetch(`/api/v1/location/states/${stateObj.code}/districts`)
      .then((r) => r.json())
      .then((d) => setDistricts(d.districts || []))
      .catch(() => setDistricts([]));
  }, [filters.state, states]);

  function handleNearMe() {
    if (!navigator.geolocation) {
      setLocError('Geolocation not supported by your browser.');
      return;
    }
    setLocating(true);
    setLocError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onUpdate({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          radiusKm: filters.radiusKm || 10,
          // Clear text-based location filters when using geo
          state: '',
          district: '',
        });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocError(
          err.code === 1
            ? 'Location permission denied. Please allow access in browser settings.'
            : 'Unable to get location. Please try again.',
        );
      },
      { timeout: 8000, maximumAge: 60000 },
    );
  }

  function clearGeo() {
    onUpdate({ lat: null, lng: null });
  }

  const hasGeo = filters.lat != null && filters.lng != null;

  const selectStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1.5px solid rgba(0,0,0,0.12)',
    borderRadius: 10,
    fontSize: 13,
    fontFamily: 'inherit',
    background: '#fff',
    color: '#1a1a1a',
    outline: 'none',
    cursor: 'pointer',
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: '#555',
    display: 'block',
    marginBottom: 4,
  };

  const checkboxRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    userSelect: 'none',
  };

  return (
    <div
      style={{
        background: '#fafaf8',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* ── Geo radius (Near me) ── */}
      <div>
        <label style={labelStyle}>📍 Radius filter</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {!hasGeo ? (
            <button
              type="button"
              onClick={handleNearMe}
              disabled={locating}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: locating ? '#ccc' : 'linear-gradient(135deg, #0D4F4F, #14897A)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: locating ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: locating ? 'none' : '0 2px 8px rgba(13,79,79,0.2)',
              }}
            >
              {locating ? '⏳ Detecting…' : '📍 Use my location'}
            </button>
          ) : (
            <div
              style={{
                flex: 1,
                background: 'rgba(20,137,122,0.08)',
                border: '1.5px solid rgba(20,137,122,0.3)',
                borderRadius: 10,
                padding: '8px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0D4F4F' }}>
                  📍 Within {filters.radiusKm} km of your location
                </span>
                <button
                  type="button"
                  onClick={clearGeo}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#DC143C',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  ✕ Remove
                </button>
              </div>

              {/* Radius presets */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {RADIUS_PRESETS.map((km) => (
                  <button
                    key={km}
                    type="button"
                    onClick={() => onUpdate({ radiusKm: km })}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 99,
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      border:
                        filters.radiusKm === km
                          ? '1.5px solid #14897A'
                          : '1.5px solid rgba(0,0,0,0.12)',
                      background: filters.radiusKm === km ? 'rgba(20,137,122,0.15)' : '#fff',
                      color: filters.radiusKm === km ? '#0D4F4F' : '#555',
                    }}
                  >
                    {km} km
                  </button>
                ))}
              </div>

              {/* Continuous slider */}
              <div>
                <input
                  type="range"
                  min={1}
                  max={100}
                  step={1}
                  value={filters.radiusKm || 10}
                  onChange={(e) => onUpdate({ radiusKm: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#14897A' }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: '#aaa',
                    marginTop: 2,
                  }}
                >
                  <span>1 km</span>
                  <span>25 km</span>
                  <span>50 km</span>
                  <span>100 km</span>
                </div>
              </div>
            </div>
          )}
        </div>
        {locError && (
          <p style={{ fontSize: 12, color: '#DC143C', margin: '6px 0 0', lineHeight: 1.4 }}>
            {locError}
          </p>
        )}
        {!hasGeo && (
          <p style={{ fontSize: 12, color: '#aaa', margin: '4px 0 0' }}>
            Shows only issues within the selected radius of your current position.
          </p>
        )}
      </div>

      {/* ── State + District ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12,
        }}
      >
        <div>
          <label style={labelStyle}>State</label>
          <select
            value={filters.state}
            onChange={(e) => onUpdate({ state: e.target.value, district: '' })}
            style={selectStyle}
            disabled={statesLoading || hasGeo}
          >
            <option value="">All states</option>
            {states.map((s) => (
              <option key={s.code} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          {hasGeo && (
            <p style={{ fontSize: 11, color: '#aaa', margin: '3px 0 0' }}>
              Disabled while "Near me" is active
            </p>
          )}
        </div>
        <div>
          <label style={labelStyle}>District</label>
          <select
            value={filters.district}
            onChange={(e) => onUpdate({ district: e.target.value })}
            style={selectStyle}
            disabled={!filters.state || districts.length === 0 || hasGeo}
          >
            <option value="">All districts</option>
            {districts.map((d) => (
              <option key={d.code || d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Date range ── */}
      <div>
        <label style={labelStyle}>Date range</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {DATE_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onUpdate({ dateRange: opt.value })}
              style={{
                padding: '5px 12px',
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
                border:
                  filters.dateRange === opt.value
                    ? '1.5px solid #14897A'
                    : '1.5px solid rgba(0,0,0,0.12)',
                background: filters.dateRange === opt.value ? 'rgba(20,137,122,0.1)' : '#fff',
                color: filters.dateRange === opt.value ? '#0D4F4F' : '#555',
                transition: 'all 0.1s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Min supporters ── */}
      <div>
        <label style={labelStyle}>
          Min. supporters
          {filters.minSupport > 0 && (
            <span style={{ marginLeft: 6, color: '#14897A' }}>≥ {filters.minSupport}</span>
          )}
        </label>
        <input
          type="range"
          min={0}
          max={500}
          step={10}
          value={filters.minSupport}
          onChange={(e) => onUpdate({ minSupport: Number(e.target.value) })}
          style={{ width: '100%', accentColor: '#14897A' }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: '#aaa',
            marginTop: 2,
          }}
        >
          <span>0</span>
          <span>100</span>
          <span>250</span>
          <span>500+</span>
        </div>
      </div>

      {/* ── Checkboxes ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <label style={checkboxRowStyle}>
          <input
            type="checkbox"
            checked={filters.hasPhotos || false}
            onChange={(e) => onUpdate({ hasPhotos: e.target.checked })}
            style={{ accentColor: '#14897A', width: 16, height: 16, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>📷 Has photos</span>
        </label>
        <label style={checkboxRowStyle}>
          <input
            type="checkbox"
            checked={filters.verifiedOnly || false}
            onChange={(e) => onUpdate({ verifiedOnly: e.target.checked })}
            style={{ accentColor: '#14897A', width: 16, height: 16, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>
            ✅ Verified location only
          </span>
        </label>
      </div>

      {/* ── Clear button ── */}
      {(filters.state ||
        filters.district ||
        filters.dateRange !== 'all' ||
        filters.minSupport > 0 ||
        filters.hasPhotos ||
        filters.verifiedOnly ||
        hasGeo) && (
        <button
          onClick={() =>
            onUpdate({
              state: '',
              district: '',
              dateRange: 'all',
              minSupport: 0,
              hasPhotos: false,
              verifiedOnly: false,
              lat: null,
              lng: null,
            })
          }
          style={{
            alignSelf: 'flex-start',
            padding: '6px 14px',
            background: 'none',
            border: '1px solid rgba(220,20,60,0.3)',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: '#DC143C',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Clear advanced filters
        </button>
      )}
    </div>
  );
}
