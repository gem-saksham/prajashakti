import { useRef, useState } from 'react';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 10;
const MAX_PHOTOS = 5;

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

async function extractExifGps(file) {
  try {
    const { gps } = await import('exifr');
    const result = await gps(file);
    if (result?.latitude && result?.longitude) {
      return { lat: result.latitude, lng: result.longitude };
    }
  } catch {
    // exifr fails gracefully
  }
  return null;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function LocationBadge({ photo, issueLocation }) {
  if (!photo.exifGps) {
    return (
      <span
        style={{
          padding: '2px 7px',
          background: 'rgba(136,136,136,0.15)',
          color: '#666',
          borderRadius: 99,
          fontSize: 10,
          fontWeight: 600,
        }}
      >
        📍 No GPS
      </span>
    );
  }

  if (!issueLocation?.lat) {
    return (
      <span
        style={{
          padding: '2px 7px',
          background: 'rgba(20,137,122,0.12)',
          color: '#14897A',
          borderRadius: 99,
          fontSize: 10,
          fontWeight: 600,
        }}
      >
        📍 Has GPS
      </span>
    );
  }

  const distKm = haversineKm(
    photo.exifGps.lat,
    photo.exifGps.lng,
    issueLocation.lat,
    issueLocation.lng,
  );

  if (distKm <= 0.5) {
    return (
      <span
        style={{
          padding: '2px 7px',
          background: 'rgba(20,137,122,0.15)',
          color: '#14897A',
          borderRadius: 99,
          fontSize: 10,
          fontWeight: 600,
        }}
      >
        ✓ Verified location
      </span>
    );
  }
  if (distKm <= 5) {
    return (
      <span
        style={{
          padding: '2px 7px',
          background: 'rgba(224,123,58,0.15)',
          color: '#E07B3A',
          borderRadius: 99,
          fontSize: 10,
          fontWeight: 600,
        }}
      >
        ⚠️ {distKm.toFixed(1)}km away
      </span>
    );
  }
  return (
    <span
      style={{
        padding: '2px 7px',
        background: 'rgba(220,20,60,0.12)',
        color: '#DC143C',
        borderRadius: 99,
        fontSize: 10,
        fontWeight: 600,
      }}
    >
      ⚠️ Location mismatch
    </span>
  );
}

export default function Step4Photos({ draft, onUpdate }) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState([]);
  const [preview, setPreview] = useState(null);

  const photos = draft.photos || [];

  async function processFiles(files) {
    const newErrors = [];
    const newPhotos = [];

    for (const file of Array.from(files)) {
      if (photos.length + newPhotos.length >= MAX_PHOTOS) {
        newErrors.push(`Maximum ${MAX_PHOTOS} photos allowed.`);
        break;
      }
      if (!ACCEPTED_TYPES.includes(file.type)) {
        newErrors.push(`${file.name}: Only JPEG, PNG, and WebP images are supported.`);
        continue;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        newErrors.push(`${file.name}: File size must be under ${MAX_SIZE_MB}MB.`);
        continue;
      }

      const exifGps = await extractExifGps(file);
      const photo = {
        id: generateId(),
        file,
        preview: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
        type: file.type,
        exifGps,
        status: 'pending',
        progress: 0,
        uploadedKey: null,
        confirmedUrl: null,
      };
      newPhotos.push(photo);
    }

    setErrors(newErrors);
    if (newPhotos.length > 0) {
      onUpdate({ photos: [...photos, ...newPhotos] });
    }
  }

  function handleFileInput(e) {
    if (e.target.files?.length) processFiles(e.target.files);
    e.target.value = '';
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  }

  function removePhoto(id) {
    const photo = photos.find((p) => p.id === id);
    if (photo?.preview) URL.revokeObjectURL(photo.preview);
    onUpdate({ photos: photos.filter((p) => p.id !== id) });
  }

  const hasGpsPhotos = photos.some((p) => p.exifGps);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* GPS tip banner */}
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
        📸 Photos with GPS data are 3× more likely to be acted upon. Take photos with your camera
        app on-site for best results.
      </div>

      {/* Counter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
          Photo Evidence
          <span style={{ fontSize: 12, fontWeight: 500, color: '#888', marginLeft: 6 }}>
            optional
          </span>
        </label>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: photos.length >= MAX_PHOTOS ? '#DC143C' : '#888',
          }}
        >
          {photos.length} / {MAX_PHOTOS} photos
        </span>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div
          style={{
            background: '#fff5f5',
            border: '1px solid rgba(220,20,60,0.2)',
            borderRadius: 10,
            padding: '10px 14px',
          }}
        >
          {errors.map((e, i) => (
            <p key={i} style={{ fontSize: 13, color: '#c0392b', margin: i > 0 ? '4px 0 0' : 0 }}>
              {e}
            </p>
          ))}
        </div>
      )}

      {/* Drop zone */}
      {photos.length < MAX_PHOTOS && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragOver ? '#14897A' : 'rgba(0,0,0,0.15)'}`,
            borderRadius: 14,
            padding: '28px 16px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? 'rgba(20,137,122,0.05)' : '#f8f8f6',
            transition: 'all 0.15s',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 10 }}>📷</div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 4 }}>
            {window.innerWidth < 600 ? 'Tap to add photos' : 'Drag photos here or click to browse'}
          </p>
          <p style={{ fontSize: 12, color: '#888' }}>JPEG, PNG, WebP · max {MAX_SIZE_MB}MB each</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        onChange={handleFileInput}
        style={{ display: 'none' }}
        capture="environment"
      />

      {/* Photo grid */}
      {photos.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: 10,
          }}
        >
          {photos.map((photo) => (
            <div
              key={photo.id}
              style={{
                position: 'relative',
                borderRadius: 12,
                overflow: 'hidden',
                border: '1.5px solid rgba(0,0,0,0.08)',
                background: '#f0f0ee',
                aspectRatio: '1',
                cursor: photo.preview ? 'pointer' : 'default',
              }}
              onClick={() => photo.preview && setPreview(photo)}
            >
              {photo.preview ? (
                <img
                  src={photo.preview}
                  alt={photo.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28,
                  }}
                >
                  🖼️
                </div>
              )}

              {/* Remove button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removePhoto(photo.id);
                }}
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.6)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>

              {/* Location badge */}
              <div style={{ position: 'absolute', bottom: 6, left: 6, right: 6 }}>
                <LocationBadge photo={photo} issueLocation={draft.location} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* GPS tip for non-geo photos */}
      {photos.length > 0 && !hasGpsPhotos && (
        <div
          style={{
            fontSize: 12,
            color: '#E07B3A',
            background: 'rgba(224,123,58,0.08)',
            borderRadius: 8,
            padding: '8px 12px',
          }}
        >
          ℹ️ These photos don't have location data. They'll still help, but geo-tagged photos carry
          more weight.
        </div>
      )}

      {/* Photo preview modal */}
      {preview && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setPreview(null)}
        >
          <div style={{ position: 'relative', maxWidth: 600, width: '100%' }}>
            <img
              src={preview.preview}
              alt={preview.name}
              style={{
                width: '100%',
                borderRadius: 12,
                display: 'block',
                maxHeight: '80vh',
                objectFit: 'contain',
              }}
            />
            {preview.exifGps && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 12,
                  left: 12,
                  background: 'rgba(0,0,0,0.7)',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontSize: 11,
                }}
              >
                📍 GPS: {preview.exifGps.lat.toFixed(5)}, {preview.exifGps.lng.toFixed(5)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
