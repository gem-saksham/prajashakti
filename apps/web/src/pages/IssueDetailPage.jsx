/**
 * IssueDetailPage — Twitter-thread style layout.
 *
 * Desktop: 2-col (feed column + sticky sidebar)
 * Mobile:  single column + fixed bottom action bar
 *
 * Feed column:
 *   IssuePostCard (the "main tweet")
 *   Sticky tab bar: Stories | Comments | Activity | Media
 *   Tab content area (swaps without re-mounting)
 *
 * Sidebar (desktop only):
 *   Support widget · Department · Related issues
 */
import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { issueApi, supportApi, storyApi } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';

import IssuePostCard from '../components/issue-detail/IssuePostCard.jsx';
import PhotoGallery from '../components/issue-detail/PhotoGallery.jsx';
import DepartmentCard from '../components/issue-detail/DepartmentCard.jsx';
import ActivityTimeline from '../components/issue-detail/ActivityTimeline.jsx';
import SupportersList from '../components/issue-detail/SupportersList.jsx';
import CommentsSection from '../components/issue-detail/CommentsSection.jsx';
import RelatedIssues from '../components/issue-detail/RelatedIssues.jsx';
import StoriesSection from '../components/issue-detail/StoriesSection.jsx';

// ── Responsive ────────────────────────────────────────────────────────────────

function useIsMobile() {
  const [v, setV] = useState(() => window.innerWidth < 769);
  useEffect(() => {
    const h = () => setV(window.innerWidth < 769);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return v;
}

// ── Back bar ──────────────────────────────────────────────────────────────────

function BackBar({ title, onBack }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 60,
        background: 'linear-gradient(135deg, #0D4F4F 0%, #14897A 100%)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: '0 auto',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            padding: '6px 14px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          ← Back
        </button>
        {title && (
          <div
            style={{
              flex: 1,
              fontSize: 14,
              fontWeight: 700,
              color: '#fff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sticky tab bar ────────────────────────────────────────────────────────────

const TABS = [
  { id: 'stories', label: '📖 Stories', countKey: 'storyCount' },
  { id: 'comments', label: '💬 Comments', countKey: 'commentCount' },
  { id: 'activity', label: '⚡ Activity', countKey: null },
  { id: 'media', label: '🖼 Media', countKey: 'photos' },
];

function TabBar({ active, onChange, issue }) {
  const onOverview = active === 'overview';
  return (
    <div
      style={{
        position: 'sticky',
        top: 56,
        zIndex: 50,
        background: '#fff',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        display: 'flex',
      }}
    >
      {/* Overview / back pill */}
      {!onOverview && (
        <button
          onClick={() => onChange('overview')}
          style={{
            padding: '12px 12px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 12,
            color: '#aaa',
            borderBottom: '2.5px solid transparent',
            flexShrink: 0,
          }}
          title="Back to overview"
        >
          ←
        </button>
      )}

      {TABS.map((t) => {
        const count =
          t.countKey === 'photos'
            ? (issue.photos?.length ?? 0)
            : t.countKey
              ? (issue[t.countKey] ?? 0)
              : null;
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              flex: 1,
              padding: '12px 4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: isActive ? 700 : 400,
              color: isActive ? '#0D4F4F' : '#888',
              borderBottom: `2.5px solid ${isActive ? '#14897A' : 'transparent'}`,
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            {t.label}
            {count !== null && count > 0 && (
              <span
                style={{
                  background: isActive ? '#14897A' : 'rgba(0,0,0,0.1)',
                  color: isActive ? '#fff' : '#666',
                  borderRadius: 99,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Feed overview (landing preview) ──────────────────────────────────────────

function timeAgoShort(d) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function FeedOverview({ issueId, issue, onTabChange }) {
  const [topStory, setTopStory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storyApi
      .list(issueId, 1, 1)
      .then((res) => {
        if (res.success && res.data.length) setTopStory(res.data[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [issueId]);

  const storyCount = issue.storyCount ?? 0;
  const commentCount = issue.commentCount ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ── Story preview ─────────────────────────────────────────────── */}
      <div style={{ padding: '18px 18px 14px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0D4F4F' }}>📖 Ground Reality</span>
          {storyCount > 1 && (
            <button onClick={() => onTabChange('stories')} style={viewAllBtn}>
              View all {storyCount} stories →
            </button>
          )}
        </div>

        {loading && <div style={{ height: 60, borderRadius: 10, background: '#f0f0f0' }} />}

        {!loading && !topStory && (
          <p style={{ margin: 0, fontSize: 13, color: '#888' }}>
            No stories yet.{' '}
            <button onClick={() => onTabChange('stories')} style={{ ...inlineLink }}>
              Be the first to share ground reality →
            </button>
          </p>
        )}

        {!loading && topStory && (
          <div
            style={{
              display: 'flex',
              gap: 10,
              padding: '12px 14px',
              background: '#f8fffe',
              border: '1px solid rgba(20,137,122,0.12)',
              borderRadius: 12,
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                flexShrink: 0,
                background: topStory.isAnonymous
                  ? 'rgba(0,0,0,0.1)'
                  : 'linear-gradient(135deg, #0D4F4F, #14897A)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {topStory.isAnonymous ? '?' : (topStory.author?.name?.[0] ?? '?')}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
                  {topStory.isAnonymous
                    ? 'Anonymous Citizen'
                    : (topStory.author?.name ?? 'Citizen')}
                </span>
                <span style={{ fontSize: 11, color: '#aaa' }}>
                  {timeAgoShort(topStory.createdAt)}
                </span>
                {topStory.helpfulCount > 0 && (
                  <span
                    style={{ marginLeft: 'auto', fontSize: 11, color: '#14897A', fontWeight: 600 }}
                  >
                    👍 {topStory.helpfulCount}
                  </span>
                )}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: '#333',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {topStory.content}
              </p>
              {storyCount > 1 && (
                <button
                  onClick={() => onTabChange('stories')}
                  style={{ ...inlineLink, marginTop: 6 }}
                >
                  + {storyCount - 1} more {storyCount - 1 === 1 ? 'story' : 'stories'} →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Divider ───────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '0 18px' }} />

      {/* ── Comments preview ──────────────────────────────────────────── */}
      <div style={{ padding: '14px 18px 18px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0D4F4F' }}>💬 Discussion</span>
          <button onClick={() => onTabChange('comments')} style={viewAllBtn}>
            {commentCount > 0 ? `View all ${commentCount} comments →` : 'Start discussion →'}
          </button>
        </div>

        <div
          onClick={() => onTabChange('comments')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '11px 14px',
            borderRadius: 12,
            cursor: 'pointer',
            border: '1.5px dashed rgba(0,0,0,0.1)',
            background: '#fafafa',
            transition: 'background 0.15s',
          }}
        >
          <span style={{ fontSize: 20 }}>💬</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>
              {commentCount > 0
                ? `${commentCount} comment${commentCount !== 1 ? 's' : ''} in this thread`
                : 'No comments yet — be the first'}
            </div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>Tap to read and reply</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const viewAllBtn = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  color: '#14897A',
  padding: 0,
  fontFamily: 'inherit',
};
const inlineLink = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  fontSize: 12,
  color: '#14897A',
  fontWeight: 600,
  fontFamily: 'inherit',
  display: 'inline',
};

// ── Desktop sidebar support widget ────────────────────────────────────────────

function SupportWidget({ issue, isSupported, onSupport, onUnsupport, onShare }) {
  const count = issue.supporterCount ?? 0;
  const targetPct = issue.targetSupporters
    ? Math.min(100, Math.round((count / issue.targetSupporters) * 100))
    : null;

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 16,
        padding: 20,
        position: 'sticky',
        top: 80,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#0D4F4F' }}>
          {count.toLocaleString()}
        </div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>citizens supporting</div>
      </div>

      {targetPct !== null && (
        <div>
          <div style={{ height: 6, borderRadius: 99, background: '#e5e7eb', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${targetPct}%`,
                background: 'linear-gradient(90deg, #0D4F4F, #14897A)',
                borderRadius: 99,
                transition: 'width 0.4s',
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 4, textAlign: 'center' }}>
            {targetPct}% of {issue.targetSupporters?.toLocaleString()} goal
          </div>
        </div>
      )}

      <button
        onClick={isSupported ? onUnsupport : onSupport}
        style={{
          padding: '11px 20px',
          borderRadius: 10,
          width: '100%',
          border: isSupported ? '2px solid #0D4F4F' : 'none',
          background: isSupported ? 'transparent' : 'linear-gradient(135deg, #0D4F4F, #14897A)',
          color: isSupported ? '#0D4F4F' : '#fff',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {isSupported ? '✓ Supported' : '🤝 Support This Issue'}
      </button>

      <button
        onClick={onShare}
        style={{
          padding: '10px 20px',
          borderRadius: 10,
          width: '100%',
          border: '1.5px solid rgba(0,0,0,0.12)',
          background: 'transparent',
          color: '#555',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        🔗 Share
      </button>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ onBack }) {
  return (
    <div style={{ background: '#F4F5F0', minHeight: '100dvh' }}>
      <BackBar title="Loading…" onBack={onBack} />
      <div
        style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px', display: 'flex', gap: 20 }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[220, 48, 300].map((h, i) => (
            <div key={i} style={{ height: h, borderRadius: 14, background: '#e5e7eb' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Error ─────────────────────────────────────────────────────────────────────

function ErrorState({ onBack }) {
  return (
    <div style={{ background: '#F4F5F0', minHeight: '100dvh' }}>
      <BackBar title="Issue not found" onBack={onBack} />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>😕</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Issue not found</div>
        <div style={{ fontSize: 14, color: '#888', marginBottom: 24 }}>
          This issue may have been removed or the link is incorrect.
        </div>
        <button
          onClick={onBack}
          style={{
            padding: '10px 24px',
            borderRadius: 10,
            background: 'linear-gradient(135deg, #0D4F4F, #14897A)',
            border: 'none',
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ← Back to Issues
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function IssueDetailPage({ issueId, onBack, onOpenIssue }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('overview');

  const [supportedIds, setSupportedIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('ps_supported_ids') || '[]'));
    } catch {
      return new Set();
    }
  });

  const isSupported = supportedIds.has(issueId);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['issue', issueId],
    queryFn: () => issueApi.get(issueId),
    staleTime: 60_000,
    retry: 1,
    enabled: !!issueId,
  });

  const issue = data?.data;

  function persistIds(next) {
    setSupportedIds(next);
    localStorage.setItem('ps_supported_ids', JSON.stringify([...next]));
  }

  async function handleSupport() {
    if (!user) {
      showToast('Please log in to support issues', 'error');
      return;
    }
    const next = new Set(supportedIds);
    next.add(issueId);
    persistIds(next);
    queryClient.setQueryData(['issue', issueId], (old) =>
      old
        ? { ...old, data: { ...old.data, supporterCount: (old.data.supporterCount ?? 0) + 1 } }
        : old,
    );
    try {
      await supportApi.support(issueId);
    } catch {
      next.delete(issueId);
      persistIds(next);
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
      showToast('Could not register support', 'error');
    }
  }

  async function handleUnsupport() {
    if (!user) return;
    const next = new Set(supportedIds);
    next.delete(issueId);
    persistIds(next);
    queryClient.setQueryData(['issue', issueId], (old) =>
      old
        ? {
            ...old,
            data: { ...old.data, supporterCount: Math.max(0, (old.data.supporterCount ?? 1) - 1) },
          }
        : old,
    );
    try {
      await supportApi.unsupport(issueId);
    } catch {
      next.add(issueId);
      persistIds(next);
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
      showToast('Could not remove support', 'error');
    }
  }

  function handleShare() {
    const url = window.location.href;
    const text = `Support this civic issue: "${issue?.title}" — ${url}`;
    if (navigator.share) {
      navigator.share({ title: issue?.title, text, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).then(() => showToast('Link copied!', 'success'));
    }
  }

  if (isLoading) return <Skeleton onBack={onBack} />;
  if (isError || !issue) return <ErrorState onBack={onBack} />;

  return (
    <div style={{ background: '#F4F5F0', minHeight: '100dvh' }}>
      <BackBar title={issue.title} onBack={onBack} />

      <div
        style={{
          maxWidth: 900,
          margin: '0 auto',
          padding: isMobile ? '16px 12px 100px' : '20px 20px 40px',
          display: 'flex',
          gap: 20,
          alignItems: 'flex-start',
        }}
      >
        {/* ── Feed column ────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Post card */}
          <IssuePostCard
            issue={issue}
            isSupported={isSupported}
            onSupport={handleSupport}
            onUnsupport={handleUnsupport}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onShare={handleShare}
          />

          {/* Tab bar */}
          <TabBar active={activeTab} onChange={setActiveTab} issue={issue} />

          {/* Tab content */}
          <div
            style={{
              background: '#fff',
              borderLeft: '1px solid rgba(0,0,0,0.08)',
              borderRight: '1px solid rgba(0,0,0,0.08)',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
              borderRadius: '0 0 16px 16px',
              minHeight: 200,
            }}
          >
            {activeTab === 'overview' && (
              <FeedOverview issueId={issueId} issue={issue} onTabChange={setActiveTab} />
            )}
            {activeTab === 'stories' && (
              <div style={{ padding: '20px 18px' }}>
                <StoriesSection issueId={issueId} initialStoryCount={issue.storyCount ?? 0} />
              </div>
            )}
            {activeTab === 'comments' && (
              <div style={{ padding: '20px 18px' }}>
                <CommentsSection commentCount={issue.commentCount ?? 0} />
              </div>
            )}
            {activeTab === 'activity' && (
              <div
                style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 24 }}
              >
                <ActivityTimeline issue={issue} />
                <SupportersList issueId={issueId} totalCount={issue.supporterCount ?? 0} />
                {isMobile && <DepartmentCard issue={issue} />}
              </div>
            )}
            {activeTab === 'media' && (
              <div style={{ padding: '20px 18px' }}>
                {issue.photos?.length > 0 ? (
                  <PhotoGallery photos={issue.photos} />
                ) : (
                  <p
                    style={{ textAlign: 'center', color: '#888', fontSize: 14, padding: '40px 0' }}
                  >
                    No photos have been attached to this issue yet.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Related issues on mobile (below feed) */}
          {isMobile && (
            <div style={{ marginTop: 16 }}>
              <RelatedIssues issueId={issueId} onOpenIssue={onOpenIssue} />
            </div>
          )}
        </div>

        {/* ── Desktop sidebar ────────────────────────────────────────────── */}
        {!isMobile && (
          <div
            style={{ width: 268, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <SupportWidget
              issue={issue}
              isSupported={isSupported}
              onSupport={handleSupport}
              onUnsupport={handleUnsupport}
              onShare={handleShare}
            />
            <DepartmentCard issue={issue} />
            <RelatedIssues issueId={issueId} onOpenIssue={onOpenIssue} />
          </div>
        )}
      </div>

      {/* Mobile fixed bottom bar */}
      {isMobile && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 80,
            background: '#fff',
            borderTop: '1px solid rgba(0,0,0,0.08)',
            padding: '10px 16px',
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
            display: 'flex',
            gap: 10,
            boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
          }}
        >
          <button
            onClick={isSupported ? handleUnsupport : handleSupport}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 10,
              border: isSupported ? '2px solid #0D4F4F' : 'none',
              background: isSupported ? 'transparent' : 'linear-gradient(135deg, #0D4F4F, #14897A)',
              color: isSupported ? '#0D4F4F' : '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {isSupported ? '✓ Supported' : '🤝 Support'}
          </button>
          <button
            onClick={handleShare}
            style={{
              padding: '12px 18px',
              borderRadius: 10,
              border: '1.5px solid rgba(0,0,0,0.12)',
              background: '#fff',
              color: '#555',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            🔗 Share
          </button>
        </div>
      )}
    </div>
  );
}
