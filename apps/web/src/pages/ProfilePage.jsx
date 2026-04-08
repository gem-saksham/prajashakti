import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { profileApi } from '../utils/api.js';
import AvatarUpload from '../components/AvatarUpload.jsx';
import EditProfileModal from '../components/EditProfileModal.jsx';
import Spinner from '../components/Spinner.jsx';

// ── Helpers ──────────────────────────────────────────────────────────────────

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 769);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 769);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

function useCountUp(target, duration = 500) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      setValue(Math.round(progress * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const ACTIVITY_ICONS = {
  issue_created: '📢',
  issue_supported: '👍',
  comment_posted: '💬',
  profile_updated: '✏️',
};

function roleBadge(role, isVerified) {
  if (role === 'leader') return { label: 'Leader ★', bg: 'rgba(220,20,60,0.1)', color: '#DC143C' };
  if (isVerified) return { label: 'Verified ✓', bg: 'rgba(20,137,122,0.12)', color: '#14897A' };
  return { label: 'Citizen', bg: 'rgba(0,0,0,0.06)', color: '#555' };
}

function reputationTier(score) {
  if (score >= 5000) return { name: 'Champion', next: null, icon: '🏆', color: '#DC143C' };
  if (score >= 1000) return { name: 'Rising Voice', next: 5000, icon: '🌟', color: '#E07B3A' };
  if (score >= 500) return { name: 'Advocate', next: 1000, icon: '🎖️', color: '#14897A' };
  if (score >= 100) return { name: 'Citizen', next: 500, icon: '🏅', color: '#0D4F4F' };
  return { name: 'New Member', next: 100, icon: '🌱', color: '#888' };
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatBox({ label, value }) {
  const count = useCountUp(value);
  return (
    <div
      style={{
        flex: 1,
        textAlign: 'center',
        padding: '14px 8px',
        animation: 'countUp 0.5s ease',
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 800, color: '#0D4F4F', lineHeight: 1 }}>{count}</div>
      <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginTop: 5, lineHeight: 1.3 }}>
        {label}
      </div>
    </div>
  );
}

const SUGGESTION_ICONS = {
  'Add your full name': '👤',
  'Write a short bio': '✏️',
  'Add a profile photo': '📷',
  'Set your location': '📍',
  'Verify with Aadhaar': '✅',
};

function CompletenessCard({ user, onEdit, onDismiss }) {
  const score = user?.profileCompleteness ?? 0;
  const suggestions = user?.profileSuggestions ?? [];
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setWidth(score), 50);
    return () => clearTimeout(id);
  }, [score]);

  const color = score >= 80 ? '#34c987' : score >= 60 ? '#E07B3A' : '#e05555';

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid rgba(0,0,0,0.08)',
        padding: '18px 20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
          Complete your profile
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color }}>{score}%</span>
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#888',
              fontSize: 16,
              lineHeight: 1,
              padding: 2,
              fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Animated progress bar */}
      <div
        style={{
          height: 6,
          background: 'rgba(0,0,0,0.07)',
          borderRadius: 99,
          overflow: 'hidden',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${width}%`,
            background: color,
            borderRadius: 99,
            transition: 'width 0.6s ease',
          }}
        />
      </div>

      {suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={onEdit}
              style={{
                padding: '5px 12px',
                background: 'rgba(20,137,122,0.08)',
                color: '#14897A',
                border: 'none',
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>{SUGGESTION_ICONS[s] ?? '+'}</span> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityItem({ item }) {
  const icon = ACTIVITY_ICONS[item.type ?? item.activityType] ?? '•';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'rgba(13,79,79,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: '#1a1a1a', lineHeight: 1.5, margin: 0 }}>
          {item.description}
        </p>
        <p style={{ fontSize: 11, color: '#888', marginTop: 3 }}>{timeAgo(item.createdAt)}</p>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ProfilePage({ onLogout }) {
  const { user, logout, updateProfile } = useAuth();
  const isMobile = useIsMobile();

  const [editOpen, setEditOpen] = useState(false);
  const [hideCompleteness, setHideCompleteness] = useState(false);
  const [activities, setActivities] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const LIMIT = 10;

  useEffect(() => {
    if (!user?.id) return;
    setActivityLoading(true);
    profileApi
      .getActivity(user.id, 1, LIMIT)
      .then((res) => {
        setActivities(res.data ?? []);
        setActivityTotal(res.pagination?.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setActivityLoading(false));
  }, [user?.id]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const nextPage = activityPage + 1;
      const res = await profileApi.getActivity(user.id, nextPage, LIMIT);
      setActivities((prev) => [...prev, ...(res.data ?? [])]);
      setActivityPage(nextPage);
    } catch {
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleAvatarUploaded(newUrl) {
    try {
      await updateProfile({ avatarUrl: newUrl });
    } catch {}
  }

  const badge = roleBadge(user?.role, user?.isVerified);
  const repScore = user?.reputationScore ?? 0;
  const tier = reputationTier(repScore);

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : null;

  const maskedPhone = user?.phone
    ? `+91 ${user.phone.slice(0, 5)} ${'•'.repeat(Math.max(0, user.phone.length - 5))}`
    : null;

  const showCompleteness = !hideCompleteness && (user?.profileCompleteness ?? 100) < 100;

  return (
    <>
      <div
        style={{
          minHeight: '100dvh',
          paddingBottom: isMobile ? 100 : 40,
          animation: 'fadeIn 0.2s ease',
        }}
      >
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {/* ── Hero / header section ── */}
          <div style={{ position: 'relative', marginBottom: 60 }}>
            {/* Gradient band */}
            <div
              style={{
                height: 160,
                background: 'linear-gradient(135deg, #0D4F4F 0%, #14897A 100%)',
              }}
            />

            {/* Edit button (top-right of gradient) */}
            <button
              onClick={() => setEditOpen(true)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                padding: '7px 16px',
                background: 'rgba(255,255,255,0.18)',
                border: '1.5px solid rgba(255,255,255,0.5)',
                borderRadius: 10,
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Edit Profile
            </button>

            {/* Avatar straddling the gradient bottom edge */}
            <div
              style={{
                position: 'absolute',
                bottom: -48,
                left: isMobile ? 20 : 24,
              }}
            >
              <div
                style={{
                  border: '4px solid #fff',
                  borderRadius: '50%',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                }}
              >
                <AvatarUpload
                  avatarUrl={user?.avatarUrl}
                  name={user?.name ?? ''}
                  size="lg"
                  editable={true}
                  onUploadComplete={handleAvatarUploaded}
                />
              </div>
            </div>
          </div>

          {/* ── Identity section ── */}
          <div style={{ padding: isMobile ? '0 16px' : '0 24px', marginBottom: 4 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                marginBottom: 4,
              }}
            >
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a1a' }}>
                {user?.name ?? 'Citizen'}
              </h1>
              <span
                style={{
                  padding: '3px 10px',
                  background: badge.bg,
                  color: badge.color,
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {badge.label}
              </span>
            </div>

            {user?.bio && (
              <p
                style={{
                  fontSize: 14,
                  color: '#555',
                  lineHeight: 1.6,
                  marginBottom: 8,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {user.bio}
              </p>
            )}

            {(user?.district || user?.state) && (
              <p
                style={{
                  fontSize: 13,
                  color: '#888',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>📍</span> {[user.district, user.state].filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          {/* ── Stats row ── */}
          <div
            style={{
              margin: isMobile ? '16px 0' : '16px',
              background: '#fff',
              borderRadius: 16,
              border: '1px solid rgba(0,0,0,0.08)',
              display: 'flex',
            }}
          >
            <StatBox label="Issues Raised" value={user?.issuesRaised ?? 0} />
            <div style={{ width: 1, background: 'rgba(0,0,0,0.07)', margin: '12px 0' }} />
            <StatBox label="Supported" value={user?.issuesSupported ?? 0} />
            <div style={{ width: 1, background: 'rgba(0,0,0,0.07)', margin: '12px 0' }} />
            <StatBox label="Comments" value={user?.commentsPosted ?? 0} />
          </div>

          {/* ── Profile completeness (dismissable) ── */}
          {showCompleteness && (
            <div style={{ margin: isMobile ? '0 0 16px' : '0 16px 16px' }}>
              <CompletenessCard
                user={user}
                onEdit={() => setEditOpen(true)}
                onDismiss={() => setHideCompleteness(true)}
              />
            </div>
          )}

          {/* ── Reputation ── */}
          <div
            style={{
              margin: isMobile ? '0 0 16px' : '0 16px 16px',
              background: '#fff',
              borderRadius: 16,
              border: '1px solid rgba(0,0,0,0.08)',
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 22 }}>{tier.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
                  Reputation Score: {repScore}
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>{tier.name}</div>
              </div>
            </div>

            {tier.next && (
              <>
                <div
                  style={{
                    height: 6,
                    background: 'rgba(0,0,0,0.07)',
                    borderRadius: 99,
                    overflow: 'hidden',
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, (repScore / tier.next) * 100)}%`,
                      background: tier.color,
                      borderRadius: 99,
                      transition: 'width 0.6s ease',
                    }}
                  />
                </div>
                <p style={{ fontSize: 12, color: '#888' }}>
                  {tier.next - repScore} more to {reputationTier(tier.next).name}{' '}
                  {reputationTier(tier.next).icon}
                </p>
              </>
            )}
          </div>

          {/* ── Activity feed ── */}
          <div
            style={{
              margin: isMobile ? '0 0 16px' : '0 16px 16px',
              background: '#fff',
              borderRadius: 16,
              border: '1px solid rgba(0,0,0,0.08)',
              padding: '18px 20px',
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>
              Recent Activity
            </h3>

            {activityLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                <Spinner size="large" />
              </div>
            ) : activities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#888', fontSize: 14 }}>
                <p style={{ fontSize: 28, marginBottom: 8 }}>🌱</p>
                No activity yet. Start by supporting an issue!
              </div>
            ) : (
              <>
                {activities.map((item, i) => (
                  <ActivityItem key={item.id ?? i} item={item} />
                ))}
                {activities.length < activityTotal && (
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    style={{
                      width: '100%',
                      marginTop: 12,
                      padding: '10px',
                      background: 'rgba(20,137,122,0.06)',
                      border: '1.5px solid rgba(20,137,122,0.2)',
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#14897A',
                      cursor: loadingMore ? 'wait' : 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    {loadingMore ? (
                      <>
                        <Spinner size="small" /> Loading...
                      </>
                    ) : (
                      'Load more'
                    )}
                  </button>
                )}
              </>
            )}
          </div>

          {/* ── Account section ── */}
          <div
            style={{
              margin: isMobile ? '0 0 16px' : '0 16px 16px',
              background: '#fff',
              borderRadius: 16,
              border: '1px solid rgba(0,0,0,0.08)',
              padding: '18px 20px',
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 14 }}>
              Account
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                memberSince && ['Member since', memberSince],
                maskedPhone && ['Phone', maskedPhone],
                [
                  'Aadhaar',
                  user?.isVerified ? (
                    <span style={{ color: '#34c987', fontWeight: 600 }}>✓ Verified</span>
                  ) : (
                    <span style={{ color: '#888' }}>
                      Not verified —{' '}
                      <button
                        onClick={() => {}}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#14897A',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          padding: 0,
                          fontSize: 'inherit',
                        }}
                      >
                        Verify now
                      </button>
                    </span>
                  ),
                ],
              ]
                .filter(Boolean)
                .map(([label, val]) => (
                  <div
                    key={label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 13,
                      padding: '10px 0',
                      borderBottom: '1px solid rgba(0,0,0,0.06)',
                    }}
                  >
                    <span style={{ color: '#888', fontWeight: 500 }}>{label}</span>
                    <span style={{ color: '#1a1a1a', fontWeight: 600 }}>{val}</span>
                  </div>
                ))}
            </div>

            {/* Logout */}
            <button
              onClick={logout}
              style={{
                marginTop: 16,
                width: '100%',
                padding: '11px',
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
              Logout
            </button>
          </div>
        </div>
      </div>

      {editOpen && <EditProfileModal onClose={() => setEditOpen(false)} />}
    </>
  );
}
