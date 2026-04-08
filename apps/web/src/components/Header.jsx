import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import AvatarUpload from './AvatarUpload.jsx';

const DESKTOP_TABS = [
  { id: 'feed', label: '📢 Feed' },
  { id: 'profile', label: '👤 Profile' },
  { id: 'settings', label: '⚙️ Settings' },
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 769);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 769);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export default function Header({ currentTab, onTabChange }) {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function navTo(tab) {
    onTabChange(tab);
    setDropOpen(false);
  }

  return (
    <header
      style={{
        background: 'linear-gradient(135deg, #0D4F4F 0%, #14897A 100%)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
      }}
    >
      <div
        style={{
          maxWidth: 820,
          margin: '0 auto',
          padding: isMobile ? '12px 16px' : '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        {/* Logo */}
        <button
          onClick={() => onTabChange('feed')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            textAlign: 'left',
          }}
        >
          <div
            style={{
              fontSize: isMobile ? 18 : 20,
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.3px',
            }}
          >
            प्रजाशक्ति
          </div>
          {!isMobile && (
            <div
              style={{
                fontSize: 9,
                color: 'rgba(255,255,255,0.6)',
                letterSpacing: 1.4,
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              Power of the Citizens
            </div>
          )}
        </button>

        {/* Desktop tab nav — centre */}
        {!isMobile && (
          <nav style={{ display: 'flex', gap: 2 }}>
            {DESKTOP_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                style={{
                  background: currentTab === t.id ? 'rgba(255,255,255,0.18)' : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: currentTab === t.id ? 700 : 500,
                  padding: '7px 16px',
                  cursor: 'pointer',
                  opacity: currentTab === t.id ? 1 : 0.72,
                  fontFamily: 'inherit',
                  transition: 'background 0.15s, opacity 0.15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>
        )}

        {/* Avatar + dropdown */}
        <div ref={dropRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setDropOpen((o) => !o)}
            aria-label="Open user menu"
            aria-expanded={dropOpen}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div style={{ border: '2px solid rgba(255,255,255,0.4)', borderRadius: '50%' }}>
              <AvatarUpload
                avatarUrl={user?.avatarUrl}
                name={user?.name ?? ''}
                size="sm"
                editable={false}
              />
            </div>
          </button>

          {dropOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                background: '#fff',
                borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
                overflow: 'hidden',
                minWidth: 168,
                zIndex: 200,
                animation: 'scaleIn 0.15s ease',
                transformOrigin: 'top right',
              }}
            >
              {/* User info */}
              <div
                style={{ padding: '12px 16px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{user?.name}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                  {user?.district ? `${user.district}, ${user.state}` : 'Location not set'}
                </div>
              </div>

              {[
                { icon: '👤', label: 'Profile', tab: 'profile' },
                { icon: '⚙️', label: 'Settings', tab: 'settings' },
              ].map((item) => (
                <button
                  key={item.tab}
                  onClick={() => navTo(item.tab)}
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid rgba(0,0,0,0.05)',
                    textAlign: 'left',
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#1a1a1a',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span>{item.icon}</span> {item.label}
                </button>
              ))}

              <button
                onClick={() => {
                  logout();
                  setDropOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#DC143C',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span>🚪</span> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
