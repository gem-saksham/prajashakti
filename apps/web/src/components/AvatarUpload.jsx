import { useRef, useState } from 'react';
import { profileApi, uploadToS3 } from '../utils/api.js';
import { useToast } from './Toast.jsx';

const SIZES = { sm: 40, md: 64, lg: 96, xl: 120 };

/** Deterministic gradient from name string */
function nameToGradient(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h},55%,38%), hsl(${(h + 40) % 360},65%,45%))`;
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * AvatarUpload — shows avatar or initials, optional camera icon for upload.
 *
 * Props:
 *   avatarUrl       — current avatar URL or null
 *   name            — user's name (for initials + gradient)
 *   size            — 'sm' | 'md' | 'lg' | 'xl'
 *   editable        — show camera button
 *   onUploadComplete(newUrl) — called after successful upload + save
 */
export default function AvatarUpload({
  avatarUrl,
  name = '',
  size = 'lg',
  editable = false,
  onUploadComplete,
}) {
  const px = SIZES[size] ?? size;
  const { showToast } = useToast();
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null); // local blob URL before upload
  const [progress, setProgress] = useState(null); // 0-100 during upload, null otherwise
  const [uploading, setUploading] = useState(false);

  const displayUrl = preview ?? avatarUrl;

  async function handleFile(file) {
    if (!file) return;

    // Validate type
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      showToast('Please choose a JPEG, PNG, or WebP image', 'error');
      return;
    }
    // Validate size (5 MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5 MB', 'error');
      return;
    }

    // Show preview immediately
    const blobUrl = URL.createObjectURL(file);
    setPreview(blobUrl);
    setUploading(true);
    setProgress(0);

    try {
      // 1. Get pre-signed URL
      const { uploadUrl, publicUrl } = await profileApi.getAvatarUploadUrl(file.type);

      // 2. Upload to S3 with progress
      await uploadToS3(uploadUrl, file, setProgress);

      // 3. Save to profile via callback (caller calls updateProfile with the new URL)
      onUploadComplete?.(publicUrl);
      showToast('Photo updated!', 'success');
    } catch (err) {
      showToast(err?.error?.message ?? 'Upload failed. Please try again.', 'error');
      setPreview(null);
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  const circumference = Math.PI * (px - 4); // circle stroke

  return (
    <div style={{ position: 'relative', width: px, height: px, flexShrink: 0 }}>
      {/* Avatar circle */}
      <div
        style={{
          width: px,
          height: px,
          borderRadius: '50%',
          overflow: 'hidden',
          background: displayUrl ? 'transparent' : nameToGradient(name),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: px * 0.33,
          fontWeight: 800,
          color: '#fff',
          userSelect: 'none',
        }}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          getInitials(name)
        )}
      </div>

      {/* Progress ring overlay */}
      {uploading && progress !== null && (
        <svg
          style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}
          width={px}
          height={px}
        >
          {/* Track */}
          <circle
            cx={px / 2}
            cy={px / 2}
            r={(px - 4) / 2}
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="3"
          />
          {/* Fill */}
          <circle
            cx={px / 2}
            cy={px / 2}
            r={(px - 4) / 2}
            fill="none"
            stroke="#34c987"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress / 100)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.2s' }}
          />
        </svg>
      )}

      {/* Camera button */}
      {editable && (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label="Change profile photo"
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: px * 0.28,
            height: px * 0.28,
            minWidth: 24,
            minHeight: 24,
            borderRadius: '50%',
            background: '#fff',
            border: '2px solid var(--color-border)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: uploading ? 'wait' : 'pointer',
            fontSize: px * 0.14,
          }}
        >
          📷
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files?.[0])}
        onClick={(e) => {
          e.target.value = '';
        }} // allow re-selecting same file
      />
    </div>
  );
}
