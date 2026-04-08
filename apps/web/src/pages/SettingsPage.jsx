import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';

// ── Shared primitives ─────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <h3
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#888',
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            margin: 0,
          }}
        >
          {title}
        </h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Row({ label, value, action }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>{label}</div>
        {value && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{value}</div>}
      </div>
      {action}
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 99,
        background: on ? '#14897A' : 'rgba(0,0,0,0.15)',
        border: 'none',
        cursor: 'pointer',
        padding: 2,
        transition: 'background 0.2s',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          transform: on ? 'translateX(20px)' : 'translateX(0)',
          transition: 'transform 0.2s',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

// ── Delete confirmation modal ─────────────────────────────────────────────────

function DeleteAccountModal({ onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 20,
          padding: '28px 24px',
          maxWidth: 340,
          width: '100%',
          textAlign: 'center',
          animation: 'scaleIn 0.15s ease',
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#DC143C', marginBottom: 8 }}>
          Delete Account
        </h3>
        <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, marginBottom: 8 }}>
          This feature is not yet available. Your account and all your civic contributions are safe.
        </p>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
          Contact support if you need assistance.
        </p>
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px',
            background: 'linear-gradient(135deg, #0D4F4F, #14897A)',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [deleteOpen, setDeleteOpen] = useState(false);

  // Notification toggles (scaffolded — non-functional)
  const [notifArea, setNotifArea] = useState(true);
  const [notifSupport, setNotifSupport] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [notifMilestones, setNotifMilestones] = useState(false);
  const [quietHours, setQuietHours] = useState(false);

  // Privacy toggles (scaffolded)
  const [showProfile, setShowProfile] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [showActivity, setShowActivity] = useState(true);

  function comingSoon() {
    showToast('Coming soon!', 'info');
  }

  return (
    <>
      <div
        style={{
          maxWidth: 820,
          margin: '0 auto',
          padding: '24px 16px 100px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          animation: 'fadeIn 0.2s ease',
        }}
      >
        {/* ── Account ── */}
        <Section title="Account">
          <Row
            label="Phone"
            value={
              user?.phone
                ? `+91 ${user.phone.slice(0, 5)} ${'•'.repeat(Math.max(0, user.phone.length - 5))}`
                : '—'
            }
          />
          <Row
            label="Email"
            value={user?.email ?? 'Not added'}
            action={
              <button
                onClick={comingSoon}
                style={{
                  background: 'none',
                  border: '1.5px solid rgba(20,137,122,0.4)',
                  borderRadius: 8,
                  color: '#14897A',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '5px 12px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  flexShrink: 0,
                }}
              >
                {user?.email ? 'Edit' : 'Add'}
              </button>
            }
          />
          <Row
            label="Google"
            value={user?.googleId ? 'Linked' : 'Not linked'}
            action={
              !user?.googleId && (
                <button
                  onClick={comingSoon}
                  style={{
                    background: 'none',
                    border: '1.5px solid rgba(20,137,122,0.4)',
                    borderRadius: 8,
                    color: '#14897A',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '5px 12px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    flexShrink: 0,
                  }}
                >
                  Link
                </button>
              )
            }
          />
        </Section>

        {/* ── Verification ── */}
        <Section title="Verification">
          <Row
            label="Aadhaar"
            value={user?.isVerified ? 'Verified ✓' : 'Not verified — required for issue filing'}
            action={
              !user?.isVerified && (
                <button
                  onClick={comingSoon}
                  style={{
                    background: 'linear-gradient(135deg, #0D4F4F, #14897A)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '7px 14px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    flexShrink: 0,
                  }}
                >
                  Verify Now
                </button>
              )
            }
          />
        </Section>

        {/* ── Notifications ── */}
        <Section title="Notifications">
          <Row
            label="New issues in my area"
            action={<Toggle on={notifArea} onChange={setNotifArea} />}
          />
          <Row
            label="Someone supports my issue"
            action={<Toggle on={notifSupport} onChange={setNotifSupport} />}
          />
          <Row
            label="Comments on my issues"
            action={<Toggle on={notifComments} onChange={setNotifComments} />}
          />
          <Row
            label="Campaign milestones"
            action={<Toggle on={notifMilestones} onChange={setNotifMilestones} />}
          />
          <Row
            label="Quiet hours"
            value="10 PM – 7 AM"
            action={<Toggle on={quietHours} onChange={setQuietHours} />}
          />
        </Section>

        {/* ── Privacy ── */}
        <Section title="Privacy">
          <Row
            label="Show my profile publicly"
            action={<Toggle on={showProfile} onChange={setShowProfile} />}
          />
          <Row
            label="Show my location"
            action={<Toggle on={showLocation} onChange={setShowLocation} />}
          />
          <Row
            label="Show my activity"
            action={<Toggle on={showActivity} onChange={setShowActivity} />}
          />
        </Section>

        {/* ── About ── */}
        <Section title="About">
          <Row label="App version" value="1.0.0" />
          <Row label="Phase" value="1 — Foundation" />
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid rgba(0,0,0,0.05)',
              fontSize: 13,
              color: '#555',
              textAlign: 'center',
            }}
          >
            Made with ❤️ for India
          </div>
          <Row
            label="Privacy Policy"
            action={
              <button
                onClick={comingSoon}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#14897A',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                View →
              </button>
            }
          />
          <Row
            label="Terms of Service"
            action={
              <button
                onClick={comingSoon}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#14897A',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                View →
              </button>
            }
          />
        </Section>

        {/* ── Danger Zone ── */}
        <Section title="Danger Zone">
          <div style={{ padding: '16px 20px' }}>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 14, lineHeight: 1.5 }}>
              Once deleted, your account and all civic contributions cannot be recovered.
            </p>
            <button
              onClick={() => setDeleteOpen(true)}
              style={{
                width: '100%',
                padding: '12px',
                background: 'none',
                border: '1.5px solid rgba(220,20,60,0.3)',
                borderRadius: 10,
                color: '#DC143C',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Delete my account
            </button>
          </div>
        </Section>
      </div>

      {deleteOpen && <DeleteAccountModal onClose={() => setDeleteOpen(false)} />}
    </>
  );
}
