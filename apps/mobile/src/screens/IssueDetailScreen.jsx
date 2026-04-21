/**
 * IssueDetailScreen (mobile) — mirrors apps/web/src/pages/IssueDetailPage.jsx.
 *
 * Single-column layout with:
 *   - Teal gradient back bar
 *   - IssuePostCard (main tweet)
 *   - Sticky tab bar: Stories | Comments | Activity | Media (with overview fallback)
 *   - Tab content (FeedOverview / StoriesSection / CommentsSection / ActivityTimeline+SupportersList+Department / PhotoGallery)
 *   - Related issues below feed
 *   - Fixed bottom action bar (Support + Share)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

import { COLORS, FONTS, RADIUS } from '../theme';
import { issueApi, storyApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { useSupportedIds } from '../hooks/useSupportedIds';
import { cacheIssueDetail, readCachedIssueDetail } from '../services/issueCache';
import OfflineBanner from '../components/OfflineBanner';

import IssuePostCard from '../components/issue-detail/IssuePostCard';
import StoriesSection from '../components/issue-detail/StoriesSection';
import CommentsSection from '../components/issue-detail/CommentsSection';
import ActivityTimeline from '../components/issue-detail/ActivityTimeline';
import SupportersList from '../components/issue-detail/SupportersList';
import DepartmentCard from '../components/issue-detail/DepartmentCard';
import PhotoGallery from '../components/issue-detail/PhotoGallery';
import RelatedIssues from '../components/issue-detail/RelatedIssues';

// ── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'stories', label: '📖 Stories', countKey: 'storyCount' },
  { id: 'comments', label: '💬 Comments', countKey: 'commentCount' },
  { id: 'activity', label: '⚡ Activity', countKey: null },
  { id: 'media', label: '🖼 Media', countKey: 'photos' },
];

// ── Back bar ─────────────────────────────────────────────────────────────────
function BackBar({ title, onBack }) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={['#0D4F4F', '#14897A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.backBarWrap}
    >
      <View style={[styles.backBarInner, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.8} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        {title ? (
          <Text style={styles.backBarTitle} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>
    </LinearGradient>
  );
}

// ── Tab bar ──────────────────────────────────────────────────────────────────
function TabBar({ active, onChange, issue }) {
  const onOverview = active === 'overview';
  return (
    <View style={styles.tabBar}>
      {!onOverview ? (
        <TouchableOpacity
          onPress={() => onChange('overview')}
          activeOpacity={0.7}
          style={styles.tabBackBtn}
        >
          <Text style={styles.tabBackText}>←</Text>
        </TouchableOpacity>
      ) : null}

      {TABS.map((t) => {
        const count =
          t.countKey === 'photos'
            ? (issue.photos?.length ?? 0)
            : t.countKey
              ? (issue[t.countKey] ?? 0)
              : null;
        const isActive = active === t.id;
        return (
          <TouchableOpacity
            key={t.id}
            activeOpacity={0.7}
            onPress={() => onChange(t.id)}
            style={[styles.tab, isActive && styles.tabActive]}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
              {t.label}
            </Text>
            {count !== null && count > 0 ? (
              <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                  {count}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Feed overview (landing) ──────────────────────────────────────────────────
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
    let cancelled = false;
    setLoading(true);
    storyApi
      .list(issueId, 1, 1)
      .then((res) => {
        if (!cancelled && res.success && res.data.length) {
          setTopStory(res.data[0]);
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [issueId]);

  const storyCount = issue.storyCount ?? 0;
  const commentCount = issue.commentCount ?? 0;

  return (
    <View>
      {/* Story preview */}
      <View style={styles.overviewBlock}>
        <View style={styles.overviewHeadRow}>
          <Text style={styles.overviewHead}>📖 Ground Reality</Text>
          {storyCount > 1 ? (
            <TouchableOpacity onPress={() => onTabChange('stories')}>
              <Text style={styles.viewAll}>View all {storyCount} stories →</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {loading ? (
          <View style={{ height: 60, borderRadius: 10, backgroundColor: '#f0f0f0' }} />
        ) : !topStory ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Text style={styles.emptyNote}>No stories yet. </Text>
            <TouchableOpacity onPress={() => onTabChange('stories')}>
              <Text style={styles.inlineLink}>Be the first to share ground reality →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.topStoryCard}>
            <View
              style={[
                styles.topStoryAvatar,
                topStory.isAnonymous ? styles.topStoryAvatarAnon : null,
              ]}
            >
              {topStory.isAnonymous ? (
                <Text style={styles.topStoryAvatarText}>?</Text>
              ) : (
                <LinearGradient
                  colors={['#0D4F4F', '#14897A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              {!topStory.isAnonymous ? (
                <Text style={styles.topStoryAvatarText}>
                  {(topStory.author?.name?.[0] ?? '?').toUpperCase()}
                </Text>
              ) : null}
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.topStoryHead}>
                <Text style={styles.topStoryName} numberOfLines={1}>
                  {topStory.isAnonymous
                    ? 'Anonymous Citizen'
                    : (topStory.author?.name ?? 'Citizen')}
                </Text>
                <Text style={styles.topStoryTime}>{timeAgoShort(topStory.createdAt)}</Text>
                {topStory.helpfulCount > 0 ? (
                  <Text style={styles.topStoryHelpful}>👍 {topStory.helpfulCount}</Text>
                ) : null}
              </View>
              <Text style={styles.topStoryContent} numberOfLines={3}>
                {topStory.content}
              </Text>
              {storyCount > 1 ? (
                <TouchableOpacity onPress={() => onTabChange('stories')} style={{ marginTop: 6 }}>
                  <Text style={styles.inlineLink}>
                    + {storyCount - 1} more {storyCount - 1 === 1 ? 'story' : 'stories'} →
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}
      </View>

      <View style={styles.overviewDivider} />

      {/* Comments preview */}
      <View style={styles.overviewBlock}>
        <View style={styles.overviewHeadRow}>
          <Text style={styles.overviewHead}>💬 Discussion</Text>
          <TouchableOpacity onPress={() => onTabChange('comments')}>
            <Text style={styles.viewAll}>
              {commentCount > 0 ? `View all ${commentCount} comments →` : 'Start discussion →'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onTabChange('comments')}
          style={styles.discussionCta}
        >
          <Text style={{ fontSize: 20 }}>💬</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.discussionTitle}>
              {commentCount > 0
                ? `${commentCount} comment${commentCount !== 1 ? 's' : ''} in this thread`
                : 'No comments yet — be the first'}
            </Text>
            <Text style={styles.discussionSub}>Tap to read and reply</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function IssueDetailScreen({ navigation, route }) {
  const issueId = route.params?.id;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { show } = useToast();
  const supported = useSupportedIds();

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [supporting, setSupporting] = useState(false);

  const loadIssue = useCallback(
    async (isRefresh = false) => {
      if (!issueId) {
        setError(true);
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await issueApi.get(issueId);
        if (res?.data) {
          setIssue(res.data);
          cacheIssueDetail(res.data);
        } else setError(true);
      } catch {
        // Try offline cache before showing error
        const cached = await readCachedIssueDetail(issueId);
        if (cached) {
          setIssue(cached);
        } else {
          setError(true);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [issueId],
  );

  useEffect(() => {
    loadIssue(false);
  }, [loadIssue]);

  const isSupported = supported.has(issueId);

  async function handleToggleSupport() {
    if (!user) {
      show({ message: 'Please log in to support issues', type: 'warning' });
      return;
    }
    if (supporting) return;
    setSupporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const nextCount = Math.max(0, (issue.supporterCount ?? 0) + (isSupported ? -1 : 1));
    // Optimistic count adjust locally for UI
    setIssue((prev) => (prev ? { ...prev, supporterCount: nextCount } : prev));
    const ok = await supported.toggle(issueId);
    setSupporting(false);
    if (!ok) {
      // Revert
      setIssue((prev) =>
        prev
          ? {
              ...prev,
              supporterCount: Math.max(0, (prev.supporterCount ?? 0) + (isSupported ? 1 : -1)),
            }
          : prev,
      );
      show({ message: "Couldn't update support. Please try again.", type: 'error' });
      return;
    }
    // Milestone celebration
    if (!isSupported) {
      const milestones = [50, 100, 250, 500, 1000, 2500, 5000, 10000];
      if (milestones.includes(nextCount)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }
  }

  async function handleShare(opts = {}) {
    if (!issue) return;
    const deepLink = `prajashakti://issues/${issue.id}`;
    const webUrl = `https://prajashakti.in/issues/${issue.id}`;
    const message = `${issue.title}\n\nSupport this civic issue on PrajaShakti:\n${webUrl}\n\n(Open in app: ${deepLink})`;

    // Share first photo via expo-sharing when requested and available.
    if (opts.withPhoto && issue.photos?.[0]?.url) {
      try {
        const available = await Sharing.isAvailableAsync();
        if (available) {
          const photoUrl = issue.photos[0].url;
          const ext = (
            photoUrl.match(/\.(jpg|jpeg|png|webp)(?:\?|$)/i)?.[1] || 'jpg'
          ).toLowerCase();
          const local = `${FileSystem.cacheDirectory}issue-${issue.id}.${ext}`;
          const { uri } = await FileSystem.downloadAsync(photoUrl, local);
          await Sharing.shareAsync(uri, {
            dialogTitle: issue.title,
            mimeType: ext === 'png' ? 'image/png' : 'image/jpeg',
          });
          return;
        }
      } catch {
        // fall through to text share
      }
    }

    try {
      await Share.share({ title: issue.title, message });
    } catch {}
  }

  function handleOpenIssue(id) {
    navigation.push('IssueDetail', { id });
  }

  // ── Loading / error ──
  if (loading) {
    return (
      <View style={styles.container}>
        <BackBar title="Loading…" onBack={() => navigation.goBack()} />
        <View style={styles.centerFill}>
          <ActivityIndicator color={COLORS.teal} size="large" />
        </View>
      </View>
    );
  }
  if (error || !issue) {
    return (
      <View style={styles.container}>
        <BackBar title="Issue not found" onBack={() => navigation.goBack()} />
        <View style={styles.centerFill}>
          <Text style={styles.errorEmoji}>😕</Text>
          <Text style={styles.errorTitle}>Issue not found</Text>
          <Text style={styles.errorSub}>
            This issue may have been removed or the link is incorrect.
          </Text>
          <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.goBack()}>
            <LinearGradient
              colors={['#0D4F4F', '#14897A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.errorBtn}
            >
              <Text style={styles.errorBtnText}>← Back to Issues</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackBar title={issue.title} onBack={() => navigation.goBack()} />
      <OfflineBanner />

      <ScrollView
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadIssue(true)}
            tintColor={COLORS.teal}
            colors={[COLORS.teal]}
          />
        }
      >
        {/* Post card */}
        <View style={{ padding: 12 }}>
          <IssuePostCard
            issue={issue}
            isSupported={isSupported}
            onSupport={handleToggleSupport}
            onUnsupport={handleToggleSupport}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onShare={handleShare}
          />
        </View>

        {/* Tab bar (sticky) */}
        <TabBar active={activeTab} onChange={setActiveTab} issue={issue} />

        {/* Tab content */}
        <View style={styles.tabContent}>
          {activeTab === 'overview' ? (
            <FeedOverview issueId={issueId} issue={issue} onTabChange={setActiveTab} />
          ) : null}
          {activeTab === 'stories' ? (
            <View style={{ padding: 18 }}>
              <StoriesSection issueId={issueId} initialStoryCount={issue.storyCount ?? 0} />
            </View>
          ) : null}
          {activeTab === 'comments' ? (
            <View style={{ padding: 18 }}>
              <CommentsSection commentCount={issue.commentCount ?? 0} />
            </View>
          ) : null}
          {activeTab === 'activity' ? (
            <View style={{ padding: 18, gap: 24 }}>
              <ActivityTimeline issue={issue} />
              <SupportersList issueId={issueId} totalCount={issue.supporterCount ?? 0} />
              <DepartmentCard issue={issue} />
            </View>
          ) : null}
          {activeTab === 'media' ? (
            <View style={{ padding: 18 }}>
              {issue.photos?.length > 0 ? (
                <PhotoGallery photos={issue.photos} />
              ) : (
                <Text style={styles.mediaEmpty}>
                  No photos have been attached to this issue yet.
                </Text>
              )}
            </View>
          ) : null}
        </View>

        {/* Related issues */}
        <View style={{ paddingHorizontal: 12, paddingTop: 16 }}>
          <RelatedIssues issueId={issueId} onOpenIssue={handleOpenIssue} />
        </View>
      </ScrollView>

      {/* Fixed bottom action bar */}
      <View style={[styles.bottomBar, { paddingBottom: 10 + insets.bottom }]}>
        <TouchableOpacity activeOpacity={0.9} onPress={handleToggleSupport} style={{ flex: 1 }}>
          {isSupported ? (
            <View style={styles.supportedBtn}>
              <Text style={styles.supportedBtnText}>✓ Supported</Text>
            </View>
          ) : (
            <LinearGradient
              colors={['#0D4F4F', '#14897A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.supportBtn}
            >
              <Text style={styles.supportBtnText}>🤝 Support</Text>
            </LinearGradient>
          )}
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} onPress={handleShare} style={styles.shareBtn}>
          <Text style={styles.shareBtnText}>🔗 Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.pageBg },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  // Back bar
  backBarWrap: {},
  backBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  backBtnText: { color: '#fff', fontSize: 13, fontWeight: FONTS.weight.semibold },
  backBarTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: FONTS.weight.bold,
    color: '#fff',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  tabBackBtn: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBackText: { fontSize: 14, color: '#aaa' },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: COLORS.teal },
  tabText: { fontSize: 13, color: '#888', fontWeight: FONTS.weight.regular },
  tabTextActive: { color: COLORS.deepTeal, fontWeight: FONTS.weight.bold },
  tabBadge: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: RADIUS.pill,
    paddingVertical: 1,
    paddingHorizontal: 6,
  },
  tabBadgeActive: { backgroundColor: COLORS.teal },
  tabBadgeText: { fontSize: 10, fontWeight: FONTS.weight.bold, color: '#666' },
  tabBadgeTextActive: { color: '#fff' },

  // Tab content
  tabContent: {
    marginHorizontal: 12,
    backgroundColor: '#fff',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    minHeight: 200,
  },

  // Overview
  overviewBlock: { paddingVertical: 14, paddingHorizontal: 18 },
  overviewHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  overviewHead: { fontSize: 13, fontWeight: FONTS.weight.bold, color: COLORS.deepTeal },
  viewAll: { fontSize: 12, fontWeight: FONTS.weight.semibold, color: COLORS.teal },
  overviewDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginHorizontal: 18 },

  emptyNote: { fontSize: 13, color: '#888' },
  inlineLink: { fontSize: 12, color: COLORS.teal, fontWeight: FONTS.weight.semibold },

  topStoryCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    backgroundColor: '#f8fffe',
    borderWidth: 1,
    borderColor: 'rgba(20,137,122,0.12)',
    borderRadius: 12,
  },
  topStoryAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  topStoryAvatarAnon: { backgroundColor: 'rgba(0,0,0,0.1)' },
  topStoryAvatarText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: FONTS.weight.bold,
    zIndex: 1,
  },
  topStoryHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  topStoryName: {
    fontSize: 13,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  topStoryTime: { fontSize: 11, color: '#aaa' },
  topStoryHelpful: {
    marginLeft: 'auto',
    fontSize: 11,
    color: COLORS.teal,
    fontWeight: FONTS.weight.semibold,
  },
  topStoryContent: { fontSize: 13, lineHeight: 20, color: '#333' },

  discussionCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#fafafa',
  },
  discussionTitle: { fontSize: 13, fontWeight: FONTS.weight.semibold, color: '#555' },
  discussionSub: { fontSize: 12, color: '#aaa', marginTop: 2 },

  mediaEmpty: {
    textAlign: 'center',
    color: '#888',
    fontSize: 14,
    paddingVertical: 40,
  },

  // Error state
  errorEmoji: { fontSize: 40, marginBottom: 16 },
  errorTitle: { fontSize: 18, fontWeight: FONTS.weight.bold, marginBottom: 8 },
  errorSub: { fontSize: 14, color: '#888', marginBottom: 24, textAlign: 'center' },
  errorBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  errorBtnText: { color: '#fff', fontSize: 14, fontWeight: FONTS.weight.bold },

  // Bottom action bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  supportBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportBtnText: { color: '#fff', fontSize: 14, fontWeight: FONTS.weight.bold },
  supportedBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.deepTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportedBtnText: {
    color: COLORS.deepTeal,
    fontSize: 14,
    fontWeight: FONTS.weight.bold,
  },
  shareBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: { color: '#555', fontSize: 14, fontWeight: FONTS.weight.semibold },
});
