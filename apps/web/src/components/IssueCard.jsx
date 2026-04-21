import { memo, useState, useMemo } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function fmt(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n || 0);
}

function daysOld(dateStr) {
  return Math.max(1, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
}

function supporterGoal(count) {
  const milestones = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000];
  return milestones.find((m) => m > count) ?? Math.ceil((count * 1.5) / 1000) * 1000;
}

function getPhotoUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) {
    if (url.includes('localhost:4566') || url.includes('localstack')) {
      const match = url.match(/\/([^/]+\/[^?]+)/);
      if (match) return `/api/v1/media/${match[1].split('/').slice(1).join('/')}`;
    }
    return url;
  }
  return `/api/v1/media/${url}`;
}

// ── Search highlighting ───────────────────────────────────────────────────────

function highlight(text, query) {
  if (!query || !text) return text;
  // Take the first word of the query to avoid overly-greedy matches
  const term = query.trim().split(/\s+/)[0];
  if (term.length < 2) return text;
  try {
    const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(re);
    if (parts.length === 1) return text;
    return parts.map((p, i) =>
      re.test(p) ? (
        <mark
          key={i}
          style={{
            background: 'rgba(20,137,122,0.18)',
            color: 'inherit',
            borderRadius: 2,
            padding: '0 1px',
          }}
        >
          {p}
        </mark>
      ) : (
        p
      ),
    );
  } catch {
    return text;
  }
}

// ── Badge configs ─────────────────────────────────────────────────────────────

const URGENCY = {
  critical: { label: 'CRITICAL', bg: '#DC143C', color: '#fff' },
  high: { label: 'HIGH', bg: '#E07B3A', color: '#fff' },
  medium: { label: 'MEDIUM', bg: '#2980b9', color: '#fff' },
  low: { label: 'LOW', bg: '#888', color: '#fff' },
};

const STATUS_LABEL = {
  active: 'Active',
  trending: 'Trending',
  escalated: 'Escalated',
  officially_resolved: 'Resolved',
  citizen_verified_resolved: 'Resolved',
  citizen_disputed: 'Disputed',
  closed: 'Closed',
};

const CATEGORY_ICON = {
  Infrastructure: '🏗️',
  Healthcare: '🏥',
  Education: '🎓',
  Safety: '🛡️',
  Environment: '🌱',
  Agriculture: '🌾',
  Corruption: '⚖️',
  'Water & Sanitation': '💧',
  'Public Transport': '🚌',
  'Urban Planning': '🏙️',
  Housing: '🏠',
  Employment: '💼',
  default: '📢',
};

// ── Component ─────────────────────────────────────────────────────────────────

function IssueCard({ issue, supported, onSupport, onCardClick, searchQuery }) {
  const [hovered, setHovered] = useState(false);

  const urgencyConf = URGENCY[issue.urgency] || URGENCY.medium;
  const statusLabel = STATUS_LABEL[issue.status] || 'Active';
  const categoryIcon = CATEGORY_ICON[issue.category] || CATEGORY_ICON.default;

  const photos = (issue.photos || []).filter((p) => p.url).slice(0, 1);
  const thumbUrl = photos.length > 0 ? getPhotoUrl(photos[0].url) : null;

  const day = daysOld(issue.createdAt);
  const count = issue.supporterCount || 0;
  const goal = supporterGoal(count);
  const progress = Math.min(100, Math.round((count / goal) * 100));

  const displayCount = supported ? count + 1 : count;

  const officialName = issue.officials?.[0]?.name || issue.targetOfficial || null;
  const officialTitle = issue.officials?.[0]?.title || issue.targetRole || null;

  function handleSupportClick(e) {
    e.stopPropagation();
    onSupport?.(issue.id, count);
  }

  function handleEscalate(e) {
    e.stopPropagation();
    // Escalate action — Phase 2 escalation flow
  }

  return (
    <article
      onClick={() => onCardClick?.(issue.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid rgba(0,0,0,0.08)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.15s, box-shadow 0.15s',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 8px 28px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.04)',
      }}
      role="article"
      aria-label={issue.title}
    >
      {/* ── Main body ── */}
      <div style={{ padding: '16px 18px 0' }}>
        {/* Row 1: badges + category icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          {/* Category pill — outlined */}
          {issue.category && (
            <span
              style={{
                padding: '3px 10px',
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 600,
                color: '#0D4F4F',
                border: '1.5px solid rgba(13,79,79,0.3)',
                background: 'transparent',
                flexShrink: 0,
              }}
            >
              {issue.category}
            </span>
          )}

          {/* Urgency — filled */}
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 800,
              background: urgencyConf.bg,
              color: urgencyConf.color,
              letterSpacing: 0.4,
              flexShrink: 0,
            }}
          >
            {urgencyConf.label}
          </span>

          {/* Day + status — dark badge */}
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 700,
              background: '#1a1a1a',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            Day {day} — {statusLabel}
          </span>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Category icon */}
          <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{categoryIcon}</span>
        </div>

        {/* Row 2: title + optional thumbnail */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: '#1a1a1a',
                lineHeight: 1.35,
                margin: '0 0 6px',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {highlight(issue.title, searchQuery)}
            </h3>
            <p
              style={{
                fontSize: 13,
                color: '#555',
                lineHeight: 1.55,
                margin: 0,
                display: '-webkit-box',
                WebkitLineClamp: thumbUrl ? 3 : 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {highlight(issue.description, searchQuery)}
            </p>
          </div>

          {/* Thumbnail */}
          {thumbUrl && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 88,
                height: 88,
                borderRadius: 12,
                overflow: 'hidden',
                flexShrink: 0,
                background: '#f0f0ee',
                border: '1px solid rgba(0,0,0,0.07)',
              }}
            >
              <img
                src={thumbUrl}
                alt="Issue photo"
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
          )}
        </div>

        {/* Row 3: location + meta */}
        <div
          style={{
            fontSize: 12,
            color: '#666',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexWrap: 'wrap',
            marginBottom: 14,
          }}
        >
          <span>📍</span>
          <span>
            {[issue.district, issue.state].filter(Boolean).join(', ') ||
              issue.formattedAddress ||
              'Location not set'}
          </span>
          {issue.isVerifiedLocation && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#14897A',
                background: 'rgba(20,137,122,0.1)',
                padding: '1px 5px',
                borderRadius: 99,
              }}
            >
              ✓ Verified
            </span>
          )}
          <span style={{ color: '#bbb' }}>·</span>
          {issue.creator?.name && !issue.isAnonymous && (
            <>
              <span>
                Posted by <strong style={{ color: '#444' }}>{issue.creator.name}</strong>
              </span>
              <span style={{ color: '#bbb' }}>·</span>
            </>
          )}
          <span>{timeAgo(issue.createdAt)}</span>
        </div>
      </div>

      {/* ── Target official + progress bar ── */}
      {(officialName || count > 0) && (
        <div
          style={{
            margin: '0 18px',
            padding: '10px 14px',
            background: '#fafaf8',
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.06)',
            marginBottom: 14,
          }}
        >
          {officialName && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
              }}
            >
              {/* Avatar circle */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0D4F4F, #14897A)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  color: '#fff',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {officialName.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#333' }}>
                  <span style={{ color: '#888' }}>Target: </span>
                  <strong>{officialName}</strong>
                  {officialTitle && <span style={{ color: '#888' }}> ({officialTitle})</span>}
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0D4F4F', flexShrink: 0 }}>
                {fmt(displayCount)} / {fmt(goal)}
              </div>
            </div>
          )}

          {/* Progress bar */}
          <div
            style={{
              height: 6,
              background: 'rgba(0,0,0,0.08)',
              borderRadius: 99,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background:
                  progress >= 80
                    ? 'linear-gradient(90deg, #DC143C, #E07B3A)'
                    : 'linear-gradient(90deg, #0D4F4F, #14897A)',
                borderRadius: 99,
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          {!officialName && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <span style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>
                {fmt(displayCount)} / {fmt(goal)} supporters
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Divider ── */}
      <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '0 18px' }} />

      {/* ── Action row ── */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 18px',
        }}
      >
        {/* Support button — large, prominent */}
        <button
          onClick={handleSupportClick}
          aria-label={supported ? 'Remove support' : 'Support this issue'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            flex: 1,
            padding: '11px 16px',
            borderRadius: 10,
            border: 'none',
            background: supported
              ? 'linear-gradient(135deg, #0a3a3a, #0D4F4F)'
              : 'linear-gradient(135deg, #0D4F4F, #14897A)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'opacity 0.15s',
            boxShadow: '0 2px 8px rgba(13,79,79,0.25)',
          }}
        >
          🤝 {supported ? 'Supported' : 'Support This Issue'}
          {supported && <span style={{ fontSize: 12 }}>✓</span>}
        </button>

        {/* Escalate button */}
        <button
          onClick={handleEscalate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '11px 14px',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, #DC143C, #c01234)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 2px 8px rgba(220,20,60,0.2)',
            flexShrink: 0,
          }}
        >
          ⚡ Escalate
        </button>

        {/* Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span
            style={{ fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 3 }}
          >
            👁 {fmt(issue.viewCount || 0)}
          </span>
          <span
            style={{ fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 3 }}
          >
            💬 {fmt(issue.commentCount || 0)}
          </span>
          {issue.storyCount > 0 && (
            <span
              style={{
                fontSize: 12,
                color: '#14897A',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                fontWeight: 500,
              }}
            >
              📖 {fmt(issue.storyCount)}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCardClick?.(issue.id);
            }}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              border: '1.5px solid rgba(20,137,122,0.3)',
              background: 'transparent',
              color: '#14897A',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            AI
          </button>
        </div>
      </div>
    </article>
  );
}

export default memo(IssueCard);
