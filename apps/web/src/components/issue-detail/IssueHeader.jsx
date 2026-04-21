/**
 * IssueHeader — top section of the issue detail page.
 * Shows urgency badge, status badge, title, meta row (category, location, date, views).
 */

const URGENCY = {
  critical: { bg: '#fef2f2', color: '#dc2626', label: 'Critical' },
  high: { bg: '#fff7ed', color: '#ea580c', label: 'High' },
  medium: { bg: '#eff6ff', color: '#2563eb', label: 'Medium' },
  low: { bg: '#f0fdf4', color: '#16a34a', label: 'Low' },
};

const STATUS = {
  active: { bg: '#f0fdf4', color: '#16a34a', label: 'Active' },
  trending: { bg: '#fff7ed', color: '#ea580c', label: 'Trending' },
  escalated: { bg: '#fef2f2', color: '#dc2626', label: 'Escalated' },
  officially_resolved: { bg: '#f0fdf4', color: '#15803d', label: 'Resolved' },
  citizen_verified_resolved: { bg: '#f0fdf4', color: '#15803d', label: 'Verified' },
  citizen_disputed: { bg: '#fff7ed', color: '#b45309', label: 'Disputed' },
  closed: { bg: '#f9fafb', color: '#6b7280', label: 'Closed' },
};

const CATEGORY_ICONS = {
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

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function IssueHeader({ issue }) {
  const urgency = URGENCY[issue.urgency] ?? URGENCY.medium;
  const status = STATUS[issue.status] ?? STATUS.active;
  const catIcon = CATEGORY_ICONS[issue.category] ?? '📌';

  const location =
    [issue.district, issue.state].filter(Boolean).join(', ') ||
    issue.formattedAddress ||
    'Location unknown';

  return (
    <div>
      {/* Badge row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 99,
            background: urgency.bg,
            color: urgency.color,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          🔴 {urgency.label}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 99,
            background: status.bg,
            color: status.color,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {status.label}
        </span>
        {issue.isCampaign && (
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 99,
              background: 'rgba(220,20,60,0.08)',
              color: '#DC143C',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            📣 Campaign
          </span>
        )}
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: '#1a1a1a',
          lineHeight: 1.3,
          margin: '0 0 14px',
        }}
      >
        {issue.title}
      </h1>

      {/* Meta row */}
      <div
        style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 13, color: '#555' }}
      >
        <span>
          {catIcon} {(issue.category ?? 'other').replace(/_/g, ' ')}
        </span>
        <span>📍 {location}</span>
        <span>🕐 {timeAgo(issue.createdAt)}</span>
        {issue.viewCount > 0 && <span>👁 {issue.viewCount.toLocaleString()} views</span>}
        {issue.isVerifiedLocation && (
          <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ GPS verified</span>
        )}
      </div>

      {/* Creator line */}
      <div style={{ marginTop: 10, fontSize: 12, color: '#888' }}>
        {issue.isAnonymous ? (
          <span>Reported anonymously</span>
        ) : (
          <span>
            Reported by{' '}
            <strong style={{ color: '#555' }}>{issue.creator?.name ?? 'Citizen'}</strong>
            {issue.creator?.district && ` · ${issue.creator.district}, ${issue.creator.state}`}
          </span>
        )}
      </div>
    </div>
  );
}
