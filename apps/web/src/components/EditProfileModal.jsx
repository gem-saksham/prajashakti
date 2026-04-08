import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from './Toast.jsx';
import { profileApi } from '../utils/api.js';
import AvatarUpload from './AvatarUpload.jsx';
import LocationAutocomplete from './LocationAutocomplete.jsx';
import Spinner from './Spinner.jsx';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 769);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 769);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#555',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const INPUT_STYLE = {
  width: '100%',
  padding: '11px 14px',
  border: '1.5px solid rgba(0,0,0,0.12)',
  borderRadius: 10,
  fontSize: 14,
  fontFamily: 'inherit',
  color: '#1a1a1a',
  background: '#f8f8f6',
  outline: 'none',
  boxSizing: 'border-box',
};

export default function EditProfileModal({ onClose }) {
  const { user, updateProfile, updateUser } = useAuth();
  const { showToast } = useToast();
  const isMobile = useIsMobile();

  const original = useRef({
    name: user?.name ?? '',
    bio: user?.bio ?? '',
    district: user?.district ?? '',
    state: user?.state ?? '',
    pincode: user?.pincode ?? '',
    locationLat: user?.locationLat ?? null,
    locationLng: user?.locationLng ?? null,
    locationDisplay: user?.district && user?.state ? `${user.district}, ${user.state}` : '',
  });

  const [form, setForm] = useState({ ...original.current });
  const [saving, setSaving] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);

  const isDirty =
    form.name !== original.current.name ||
    form.bio !== original.current.bio ||
    form.district !== original.current.district ||
    form.state !== original.current.state;

  // Lock body scroll on mount
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Keyboard: Escape = close (with dirty check)
  useEffect(() => {
    function handle(e) {
      if (e.key === 'Escape') attemptClose();
    }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  });

  function attemptClose() {
    if (isDirty) setDiscardConfirm(true);
    else onClose();
  }

  async function handleAvatarUploaded(newUrl) {
    try {
      await updateProfile({ avatarUrl: newUrl });
      showToast('Photo updated!', 'success');
    } catch {
      showToast('Could not save photo. Try again.', 'error');
    }
  }

  async function handleRemoveAvatar() {
    try {
      const result = await profileApi.deleteAvatar();
      updateUser(result.user);
      showToast('Photo removed', 'info');
    } catch {
      showToast('Could not remove photo. Try again.', 'error');
    }
  }

  function handleLocationSelect(loc) {
    setForm((f) => ({
      ...f,
      district: loc.district,
      state: loc.state,
      pincode: loc.pincode ?? '',
      locationLat: loc.lat,
      locationLng: loc.lng,
      locationDisplay: loc.displayName,
    }));
  }

  function handleLocationClear() {
    setForm((f) => ({
      ...f,
      district: '',
      state: '',
      pincode: '',
      locationLat: null,
      locationLng: null,
      locationDisplay: '',
    }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    if (form.name.trim().length < 2) {
      showToast('Name must be at least 2 characters', 'error');
      return;
    }

    setSaving(true);
    try {
      const updates = {};
      if (form.name !== original.current.name) updates.name = form.name.trim();
      if (form.bio !== original.current.bio) updates.bio = form.bio;
      if (form.district !== original.current.district) updates.district = form.district;
      if (form.state !== original.current.state) updates.state = form.state;
      if (form.pincode !== original.current.pincode && form.pincode) updates.pincode = form.pincode;
      if (form.locationLat !== original.current.locationLat && form.locationLat != null) {
        updates.locationLat = form.locationLat;
        updates.locationLng = form.locationLng;
      }

      if (Object.keys(updates).length > 0) {
        await updateProfile(updates);
      }
      showToast('Profile updated!', 'success');
      onClose();
    } catch (err) {
      showToast(err?.error?.message ?? 'Save failed. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    backdropFilter: 'blur(4px)',
    zIndex: 300,
    display: 'flex',
    alignItems: isMobile ? 'flex-end' : 'center',
    justifyContent: 'center',
  };

  const modalStyle = {
    background: '#fff',
    borderRadius: isMobile ? '20px 20px 0 0' : 20,
    width: isMobile ? '100%' : 480,
    maxHeight: isMobile ? '92dvh' : '85vh',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    animation: isMobile ? 'slideUp 0.25s ease' : 'scaleIn 0.2s ease',
  };

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) attemptClose();
      }}
    >
      <div style={modalStyle} role="dialog" aria-modal="true" aria-label="Edit Profile">
        {/* ── Header ── */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(0,0,0,0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            background: '#fff',
            borderRadius: isMobile ? '20px 20px 0 0' : '20px 20px 0 0',
            zIndex: 1,
          }}
        >
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a' }}>Edit Profile</h2>
          <button
            onClick={attemptClose}
            aria-label="Close"
            style={{
              background: 'rgba(0,0,0,0.06)',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              fontSize: 18,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#555',
              fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        </div>

        {/* ── Body ── */}
        <div
          style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}
        >
          {/* Avatar section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <AvatarUpload
              avatarUrl={user?.avatarUrl}
              name={user?.name ?? ''}
              size="xl"
              editable={true}
              onUploadComplete={handleAvatarUploaded}
            />
            {user?.avatarUrl && (
              <button
                onClick={handleRemoveAvatar}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#DC143C',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  padding: '2px 8px',
                  fontWeight: 500,
                }}
              >
                Remove photo
              </button>
            )}
          </div>

          {/* Name */}
          <Field label="Name *">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Your full name"
              maxLength={100}
              style={INPUT_STYLE}
            />
          </Field>

          {/* Bio */}
          <Field label={`Bio (${form.bio.length} / 500)`}>
            <textarea
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              placeholder="Tell citizens about yourself..."
              maxLength={500}
              rows={3}
              style={{
                ...INPUT_STYLE,
                resize: 'vertical',
                minHeight: 80,
                lineHeight: 1.6,
              }}
            />
          </Field>

          {/* Location */}
          <Field label="Location">
            <LocationAutocomplete
              value={form.locationDisplay}
              onChange={handleLocationSelect}
              onClear={handleLocationClear}
              placeholder="Search city, district, pincode..."
            />
          </Field>

          {/* Read-only district / state */}
          {(form.district || form.state) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="District">
                <input
                  readOnly
                  value={form.district}
                  style={{ ...INPUT_STYLE, color: '#888', cursor: 'default' }}
                />
              </Field>
              <Field label="State">
                <input
                  readOnly
                  value={form.state}
                  style={{ ...INPUT_STYLE, color: '#888', cursor: 'default' }}
                />
              </Field>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid rgba(0,0,0,0.07)',
            display: 'flex',
            gap: 10,
            flexShrink: 0,
            position: 'sticky',
            bottom: 0,
            background: '#fff',
          }}
        >
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            style={{
              flex: 1,
              padding: '13px',
              background:
                saving || !isDirty
                  ? 'rgba(0,0,0,0.08)'
                  : 'linear-gradient(135deg, #0D4F4F, #14897A)',
              color: saving || !isDirty ? '#888' : '#fff',
              border: 'none',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              cursor: saving || !isDirty ? 'default' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background 0.2s',
            }}
          >
            {saving ? (
              <>
                <Spinner size="small" color="#888" /> Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
          <button
            onClick={attemptClose}
            style={{
              padding: '13px 20px',
              background: 'none',
              border: 'none',
              color: '#555',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              borderRadius: 12,
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* ── Discard confirmation ── */}
      {discardConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '24px 20px',
              maxWidth: 320,
              width: '100%',
              textAlign: 'center',
              animation: 'scaleIn 0.15s ease',
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#1a1a1a' }}>
              Discard changes?
            </h3>
            <p style={{ fontSize: 14, color: '#555', marginBottom: 20, lineHeight: 1.5 }}>
              You have unsaved changes. They will be lost.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '11px',
                  background: '#DC143C',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Discard
              </button>
              <button
                onClick={() => setDiscardConfirm(false)}
                style={{
                  flex: 1,
                  padding: '11px',
                  background: 'rgba(0,0,0,0.06)',
                  color: '#1a1a1a',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Keep Editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
