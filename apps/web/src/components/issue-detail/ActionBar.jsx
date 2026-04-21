/**
 * ActionBar — sticky support / share / comment bar.
 * Desktop: fixed sidebar card. Mobile: sticky bottom strip.
 */
import { useState } from 'react';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 769);
  if (typeof window !== 'undefined') {
    // Add listener once on mount via useEffect called by consumer; here we just init.
  }
  return isMobile;
}

export default function ActionBar({ issue, isSupported, onSupport, onUnsupport, isMobile }) {
  const count = issue.supporterCount ?? 0;
  const targetPct = issue.targetSupporters
    ? Math.min(100, Math.round((count / issue.targetSupporters) * 100))
    : null;

  function handleShare() {
    const url = window.location.href;
    const text = `Support this civic issue: "${issue.title}" — ${url}`;
    if (navigator.share) {
      navigator.share({ title: issue.title, text, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).then(() => {
        alert('Link copied to clipboard!');
      });
    }
  }

  const supportBtn = (
    <button
      onClick={isSupported ? onUnsupport : onSupport}
      style={{
        flex: 1,
        padding: isMobile ? '12px 0' : '13px 20px',
        borderRadius: 10,
        border: isSupported ? '2px solid #0D4F4F' : 'none',
        background: isSupported ? 'transparent' : 'linear-gradient(135deg, #0D4F4F, #14897A)',
        color: isSupported ? '#0D4F4F' : '#fff',
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        transition: 'opacity 0.15s',
      }}
    >
      {isSupported ? '✓' : '👍'} {isSupported ? 'Supported' : 'Support'}
      {count > 0 && (
        <span
          style={{
            background: isSupported ? '#0D4F4F' : 'rgba(255,255,255,0.25)',
            color: isSupported ? '#fff' : '#fff',
            borderRadius: 99,
            fontSize: 11,
            fontWeight: 700,
            padding: '1px 7px',
          }}
        >
          {count.toLocaleString()}
        </span>
      )}
    </button>
  );

  const shareBtn = (
    <button
      onClick={handleShare}
      style={{
        flex: isMobile ? undefined : 1,
        padding: isMobile ? '12px 14px' : '13px 20px',
        borderRadius: 10,
        border: '1.5px solid rgba(0,0,0,0.12)',
        background: '#fff',
        color: '#555',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
      }}
    >
      🔗 Share
    </button>
  );

  if (isMobile) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderTop: '1px solid rgba(0,0,0,0.08)',
          padding: '10px 16px',
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
          display: 'flex',
          gap: 10,
          zIndex: 80,
          boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
        }}
      >
        {supportBtn}
        {shareBtn}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'sticky',
        top: 80,
        background: '#fff',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Supporter count */}
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0D4F4F' }}>
          {count.toLocaleString()}
        </div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>citizens supporting</div>
      </div>

      {/* Campaign progress bar */}
      {targetPct !== null && (
        <div>
          <div
            style={{
              height: 6,
              borderRadius: 99,
              background: '#e5e7eb',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${targetPct}%`,
                background: 'linear-gradient(90deg, #0D4F4F, #14897A)',
                borderRadius: 99,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' }}>
            {targetPct}% of {issue.targetSupporters?.toLocaleString()} goal
          </div>
        </div>
      )}

      {supportBtn}
      {shareBtn}
    </div>
  );
}
