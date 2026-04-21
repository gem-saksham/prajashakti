/**
 * SupportersList — collapsible list of supporters with avatar initials.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supportApi } from '../../utils/api.js';

function Initials({ name, size = 32 }) {
  const initials = (name ?? 'C')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const hue = ((name ?? 'C').charCodeAt(0) * 7) % 360;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `hsl(${hue}, 50%, 55%)`,
        color: '#fff',
        fontSize: size * 0.38,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

export default function SupportersList({ issueId, totalCount }) {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['supporters', issueId],
    queryFn: () => supportApi.getSupporters(issueId, 1, 12),
    enabled: expanded,
    staleTime: 60_000,
  });

  const supporters = data?.data ?? [];

  return (
    <div>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 0,
          fontFamily: 'inherit',
        }}
      >
        <h3
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#555',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          👥 Supporters{' '}
          {totalCount > 0 && (
            <span style={{ color: '#0D4F4F' }}>({totalCount.toLocaleString()})</span>
          )}
        </h3>
        <span style={{ fontSize: 12, color: '#888' }}>{expanded ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          {isLoading ? (
            <div style={{ fontSize: 13, color: '#888' }}>Loading…</div>
          ) : supporters.length === 0 ? (
            <div style={{ fontSize: 13, color: '#888' }}>No supporters yet — be the first!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {supporters.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Initials name={s.name} size={32} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
                      {s.name}
                      {s.isVerified && (
                        <span style={{ color: '#16a34a', fontSize: 11, marginLeft: 4 }}>✓</span>
                      )}
                    </div>
                    {s.district && (
                      <div style={{ fontSize: 11, color: '#888' }}>
                        {s.district}, {s.state}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {totalCount > supporters.length && (
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                  +{(totalCount - supporters.length).toLocaleString()} more
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
