/**
 * LocationSection — map iframe + address details.
 */
export default function LocationSection({ issue }) {
  const lat = issue.locationLat != null ? Number(issue.locationLat) : null;
  const lng = issue.locationLng != null ? Number(issue.locationLng) : null;
  const hasCoords = lat != null && !isNaN(lat) && lng != null && !isNaN(lng);
  const addressParts = [issue.formattedAddress, issue.district, issue.state, issue.pincode].filter(
    Boolean,
  );

  if (!hasCoords && !addressParts.length) return null;

  return (
    <div>
      <h3
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#555',
          margin: '0 0 10px',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Location
      </h3>

      {hasCoords && (
        <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
          <iframe
            title="Issue location"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.007},${lng + 0.01},${lat + 0.007}&layer=mapnik&marker=${lat},${lng}`}
            style={{ width: '100%', height: 200, border: 'none', display: 'block' }}
            loading="lazy"
          />
        </div>
      )}

      {addressParts.length > 0 && (
        <div
          style={{ fontSize: 13, color: '#555', display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          {issue.formattedAddress && <span>{issue.formattedAddress}</span>}
          {(issue.district || issue.state) && (
            <span>
              {[issue.district, issue.state].filter(Boolean).join(', ')}
              {issue.pincode && ` – ${issue.pincode}`}
            </span>
          )}
          {hasCoords && (
            <span style={{ color: '#999', fontSize: 12 }}>
              {lat.toFixed(5)}, {lng.toFixed(5)}
              {issue.isVerifiedLocation && (
                <span style={{ color: '#16a34a', marginLeft: 6, fontWeight: 600 }}>
                  ✓ GPS verified
                </span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
