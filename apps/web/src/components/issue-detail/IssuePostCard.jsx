/**
 * IssuePostCard — the "main tweet" at the top of the issue detail feed.
 * Compact but complete: badges → title → description → chips → photos → stats → actions.
 */
import { useState } from 'react';

const URGENCY = {
  critical: { color: '#dc2626', bg: '#fef2f2', label: 'Critical' },
  high: { color: '#ea580c', bg: '#fff7ed', label: 'High' },
  medium: { color: '#2563eb', bg: '#eff6ff', label: 'Medium' },
  low: { color: '#16a34a', bg: '#f0fdf4', label: 'Low' },
};
const STATUS = {
  active: { color: '#16a34a', bg: '#f0fdf4', label: 'Active' },
  trending: { color: '#ea580c', bg: '#fff7ed', label: 'Trending' },
  escalated: { color: '#dc2626', bg: '#fef2f2', label: 'Escalated' },
  officially_resolved: { color: '#15803d', bg: '#f0fdf4', label: 'Resolved' },
  citizen_verified_resolved: { color: '#15803d', bg: '#f0fdf4', label: 'Verified' },
  citizen_disputed: { color: '#b45309', bg: '#fff7ed', label: 'Disputed' },
  closed: { color: '#6b7280', bg: '#f9fafb', label: 'Closed' },
};
const CATEGORY_ICON = {
  roads: '🛣️',
  water: '💧',
  electricity: '⚡',
  sanitation: '🗑️',
  healthcare: '🏥',
  education: '📚',
  public_safety: '🚔',
  environment: '🌿',
  other: '📌',
};

function fmt(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
function timeAgo(d) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function Chip({ children, color, bg }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 9px',
        borderRadius: 99,
        background: bg,
        color,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

function StatPill({ icon, value, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        background: 'none',
        border: 'none',
        cursor: onClick ? 'pointer' : 'default',
        padding: '4px 0',
        borderRadius: 6,
        color: active ? '#14897A' : '#666',
        fontSize: 13,
        fontWeight: active ? 700 : 400,
        transition: 'color 0.15s',
      }}
    >
      <span style={{ fontSize: 15 }}>{icon}</span>
      {fmt(value)}
    </button>
  );
}

export default function IssuePostCard({
  issue,
  isSupported,
  onSupport,
  onUnsupport,
  activeTab,
  onTabChange,
  onShare,
}) {
  const [expanded, setExpanded] = useState(false);
  const urgency = URGENCY[issue.urgency] ?? URGENCY.medium;
  const status = STATUS[issue.status] ?? STATUS.active;
  const catIcon = CATEGORY_ICON[issue.category] ?? '📌';
  const location =
    [issue.district, issue.state].filter(Boolean).join(', ') || issue.formattedAddress || '';
  const descLines = (issue.description ?? '').split('\n');
  const descLong = issue.description?.length > 180;

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* Urgency accent bar */}
      <div style={{ height: 4, background: urgency.color, opacity: 0.7 }} />

      <div style={{ padding: '16px 18px 0' }}>
        {/* Badges + time */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            marginBottom: 10,
          }}
        >
          <Chip color={urgency.color} bg={urgency.bg}>
            🔴 {urgency.label}
          </Chip>
          <Chip color={status.color} bg={status.bg}>
            {status.label}
          </Chip>
          {issue.isCampaign && (
            <Chip color="#DC143C" bg="rgba(220,20,60,0.08)">
              📣 Campaign
            </Chip>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#aaa' }}>
            {timeAgo(issue.createdAt)}
          </span>
        </div>

        {/* Title */}
        <h2
          style={{
            margin: '0 0 8px',
            fontSize: 20,
            fontWeight: 800,
            color: '#1a1a1a',
            lineHeight: 1.3,
          }}
        >
          {issue.title}
        </h2>

        {/* Reporter */}
        <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
          {issue.isAnonymous ? (
            'Reported anonymously'
          ) : (
            <>
              Reported by{' '}
              <strong style={{ color: '#555' }}>{issue.creator?.name ?? 'Citizen'}</strong>
            </>
          )}
          {issue.isVerifiedLocation && (
            <span style={{ marginLeft: 8, color: '#16a34a', fontWeight: 600 }}>✓ GPS verified</span>
          )}
        </div>

        {/* Description */}
        {issue.description && (
          <div style={{ marginBottom: 12 }}>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.65,
                color: '#333',
                display: '-webkit-box',
                WebkitLineClamp: expanded ? 'unset' : 3,
                WebkitBoxOrient: 'vertical',
                overflow: expanded ? 'visible' : 'hidden',
              }}
            >
              {issue.description}
            </p>
            {descLong && (
              <button
                onClick={() => setExpanded(!expanded)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#14897A',
                  fontSize: 13,
                  cursor: 'pointer',
                  padding: '4px 0',
                  fontWeight: 600,
                }}
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        {/* Meta chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          <span
            style={{
              fontSize: 12,
              color: '#555',
              background: '#f4f5f0',
              borderRadius: 99,
              padding: '3px 10px',
            }}
          >
            {catIcon} {(issue.category ?? 'other').replace(/_/g, ' ')}
          </span>
          {location && (
            <span
              style={{
                fontSize: 12,
                color: '#555',
                background: '#f4f5f0',
                borderRadius: 99,
                padding: '3px 10px',
              }}
            >
              📍 {location}
            </span>
          )}
          {issue.departmentName && (
            <span
              style={{
                fontSize: 12,
                color: '#0D4F4F',
                background: 'rgba(13,79,79,0.08)',
                borderRadius: 99,
                padding: '3px 10px',
              }}
            >
              🏛 {issue.departmentName}
            </span>
          )}
        </div>

        {/* Photo strip */}
        {issue.photos?.length > 0 && (
          <div
            style={{ display: 'flex', gap: 6, marginBottom: 14, cursor: 'pointer' }}
            onClick={() => onTabChange('media')}
          >
            {issue.photos.slice(0, 4).map((p, i) => (
              <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                <img
                  src={p.url}
                  alt=""
                  style={{
                    width: 72,
                    height: 60,
                    objectFit: 'cover',
                    borderRadius: 8,
                    border: '1px solid rgba(0,0,0,0.08)',
                  }}
                />
                {i === 3 && issue.photos.length > 4 && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 8,
                      background: 'rgba(0,0,0,0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    +{issue.photos.length - 4}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div
        style={{
          padding: '10px 18px',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <StatPill icon="👥" value={issue.supporterCount ?? 0} active={false} />
        <StatPill
          icon="📖"
          value={issue.storyCount ?? 0}
          active={activeTab === 'stories'}
          onClick={() => onTabChange('stories')}
        />
        <StatPill
          icon="💬"
          value={issue.commentCount ?? 0}
          active={activeTab === 'comments'}
          onClick={() => onTabChange('comments')}
        />
        <StatPill icon="👁" value={issue.viewCount ?? 0} active={false} />
      </div>

      {/* Engagement row */}
      <div
        style={{
          padding: '10px 18px 14px',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={isSupported ? onUnsupport : onSupport}
          style={{
            flex: 1,
            minWidth: 120,
            padding: '9px 16px',
            borderRadius: 10,
            border: isSupported ? '2px solid #0D4F4F' : 'none',
            background: isSupported ? 'transparent' : 'linear-gradient(135deg, #0D4F4F, #14897A)',
            color: isSupported ? '#0D4F4F' : '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {isSupported ? '✓ Supported' : '🤝 Support'}
        </button>

        <button onClick={() => onTabChange('comments')} style={engBtn(activeTab === 'comments')}>
          💬 Comment
        </button>
        <button onClick={() => onTabChange('stories')} style={engBtn(activeTab === 'stories')}>
          📖 Story
        </button>
        <button onClick={() => onTabChange('activity')} style={engBtn(activeTab === 'activity')}>
          ⚡ Activity
        </button>
        <button onClick={onShare} style={engBtn(false)}>
          🔗
        </button>
      </div>
    </div>
  );
}

function engBtn(active) {
  return {
    padding: '9px 12px',
    borderRadius: 10,
    border: `1.5px solid ${active ? '#14897A' : 'rgba(0,0,0,0.1)'}`,
    background: active ? 'rgba(20,137,122,0.06)' : 'transparent',
    color: active ? '#14897A' : '#555',
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}
