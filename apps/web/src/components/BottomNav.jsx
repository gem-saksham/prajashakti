import { useEffect, useState } from 'react';

const TABS = [
  { id: 'feed', icon: '📢', label: 'Feed' },
  { id: 'create', icon: '➕', label: 'Create' },
  { id: 'notifications', icon: '🔔', label: 'Alerts' },
  { id: 'profile', icon: '👤', label: 'Profile' },
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

export default function BottomNav({ currentTab, onTabChange }) {
  const isMobile = useIsMobile();
  if (!isMobile) return null;

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#fff',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        display: 'flex',
        zIndex: 90,
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
      }}
    >
      {TABS.map((tab) => {
        const isActive = currentTab === tab.id;
        const isCreate = tab.id === 'create';

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
            style={{
              flex: 1,
              padding: '10px 4px 8px',
              background: 'none',
              border: 'none',
              borderTop: isActive && !isCreate ? '3px solid #0D4F4F' : '3px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              fontFamily: 'inherit',
              transition: 'opacity 0.1s',
            }}
          >
            {isCreate ? (
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: '#DC143C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  marginBottom: -2,
                  boxShadow: '0 2px 8px rgba(220,20,60,0.35)',
                }}
              >
                {tab.icon}
              </span>
            ) : (
              <span style={{ fontSize: 22, lineHeight: 1 }}>{tab.icon}</span>
            )}
            <span
              style={{
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                color: isCreate ? '#DC143C' : isActive ? '#0D4F4F' : '#888',
                lineHeight: 1,
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
