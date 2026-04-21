import LocationAutocomplete from '../LocationAutocomplete.jsx';

export default function Step2Location({ draft, onUpdate }) {
  const location = draft.location;

  function handleLocationSelect(loc) {
    onUpdate({ location: loc });
  }

  function handleClearLocation() {
    onUpdate({ location: null });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Tip */}
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
        📍 <strong>Tip:</strong> Use GPS for the most accurate location, or search by name below.
      </div>

      {/* Location picker */}
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
          Location <span style={{ color: '#DC143C' }}>*</span>
        </label>
        <LocationAutocomplete
          value={location?.displayName}
          onChange={handleLocationSelect}
          onClear={handleClearLocation}
          placeholder="Search your location or use GPS..."
        />
      </div>

      {/* Map preview (shown once location is selected) */}
      {location?.lat != null && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div
            style={{
              borderRadius: 14,
              overflow: 'hidden',
              border: '1.5px solid rgba(0,0,0,0.1)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            }}
          >
            <iframe
              title="Location map"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.lng - 0.012},${location.lat - 0.008},${location.lng + 0.012},${location.lat + 0.008}&layer=mapnik&marker=${location.lat},${location.lng}`}
              style={{ width: '100%', height: 240, border: 'none', display: 'block' }}
              loading="lazy"
            />
          </div>
          <p style={{ fontSize: 11, color: '#888', marginTop: 6, textAlign: 'center' }}>
            Showing selected location — search again above to change it
          </p>

          {/* Location details */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              marginTop: 12,
            }}
          >
            {[
              { label: 'District', value: location.district },
              { label: 'State', value: location.state },
              { label: 'Pincode', value: location.pincode },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  background: '#f8f8f6',
                  borderRadius: 10,
                  padding: '10px 12px',
                  border: '1px solid rgba(0,0,0,0.07)',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: '#888',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: 3,
                  }}
                >
                  {label}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: value ? '#1a1a1a' : '#bbb' }}>
                  {value || '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!location && (
        <div
          style={{
            background: '#f8f8f6',
            borderRadius: 14,
            border: '1.5px dashed rgba(0,0,0,0.15)',
            padding: '32px 16px',
            textAlign: 'center',
            color: '#aaa',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 10 }}>🗺️</div>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No location selected yet</p>
          <p style={{ fontSize: 13 }}>Use GPS above or search by name</p>
        </div>
      )}
    </div>
  );
}
