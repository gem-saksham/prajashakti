import { useState, useRef, useEffect } from 'react';

const OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'most_supported', label: 'Most supported' },
  { value: 'most_urgent', label: 'Most urgent' },
  { value: 'most_viewed', label: 'Most viewed' },
  { value: 'trending', label: 'Trending' },
  { value: 'recently_updated', label: 'Recently updated' },
  { value: 'oldest_unresolved', label: 'Oldest unresolved' },
  { value: 'oldest', label: 'Oldest first' },
];

export default function SortDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = OPTIONS.find((o) => o.value === value) || OPTIONS[0];

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 12px',
          background: '#fff',
          border: '1.5px solid rgba(0,0,0,0.12)',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          color: '#333',
          cursor: 'pointer',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >
        ↕ {current.label}
        <span style={{ fontSize: 10, color: '#888', marginLeft: 2 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 300,
            overflow: 'hidden',
            minWidth: 180,
            animation: 'scaleIn 0.12s ease',
            transformOrigin: 'top right',
          }}
        >
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: opt.value === value ? 'rgba(13,79,79,0.06)' : 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(0,0,0,0.05)',
                textAlign: 'left',
                fontSize: 13,
                fontWeight: opt.value === value ? 700 : 400,
                color: opt.value === value ? '#0D4F4F' : '#333',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {opt.value === value ? '✓ ' : '   '}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
