/**
 * IssueCard (mobile) — mirrors the web IssueCard.jsx visually and structurally.
 *
 * Uses `expo-linear-gradient` for the support / escalate buttons and progress fill.
 * Photo URLs that point at LocalStack are rewritten to the API media proxy via
 * `resolveMediaUri` so physical devices can actually load them.
 */
import React, { memo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, RADIUS } from '../theme';
import { getDevHost, API_URL } from '../utils/config';

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
  if (n == null) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function daysOld(dateStr) {
  return Math.max(1, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
}

function supporterGoal(count) {
  const milestones = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000];
  return milestones.find((m) => m > count) ?? Math.ceil((count * 1.5) / 1000) * 1000;
}

function resolveMediaUri(url) {
  if (!url) return null;
  // Absolute HTTP URL → rewrite LocalStack to media proxy
  if (url.startsWith('http')) {
    const m = url.match(/^http:\/\/(?:localhost|127\.0\.0\.1):4566\/[^/?]+\/([^?]+)/);
    if (m) {
      const host = getDevHost();
      if (host && host !== 'localhost') {
        return `http://${host}:3000/api/v1/media/${m[1]}`;
      }
    }
    return url;
  }
  // Relative key → media proxy
  const base = API_URL.endsWith('/api/v1') ? API_URL : API_URL;
  return `${base}/media/${url.replace(/^\//, '')}`;
}

// ── Badge configs ─────────────────────────────────────────────────────────────

const URGENCY = {
  critical: { label: 'CRITICAL', bg: '#DC143C' },
  high: { label: 'HIGH', bg: '#E07B3A' },
  medium: { label: 'MEDIUM', bg: '#2980b9' },
  low: { label: 'LOW', bg: '#888' },
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

function IssueCard({ issue, supported, onSupport, onPress }) {
  const urgencyConf = URGENCY[issue.urgency] || URGENCY.medium;
  const statusLabel = STATUS_LABEL[issue.status] || 'Active';
  const categoryIcon = CATEGORY_ICON[issue.category] || CATEGORY_ICON.default;

  const photos = (issue.photos || []).filter((p) => p.url).slice(0, 1);
  const thumbUrl = photos.length > 0 ? resolveMediaUri(photos[0].url) : null;

  const day = daysOld(issue.createdAt);
  const count = issue.supporterCount || 0;
  const goal = supporterGoal(count);
  const progress = Math.min(100, Math.round((count / goal) * 100));
  const displayCount = supported ? count + 1 : count;

  const officialName = issue.officials?.[0]?.name || issue.targetOfficial || null;
  const officialTitle = issue.officials?.[0]?.title || issue.targetRole || null;

  const location =
    [issue.district, issue.state].filter(Boolean).join(', ') ||
    issue.formattedAddress ||
    'Location not set';

  const supportBtnColors = supported ? ['#0a3a3a', '#0D4F4F'] : ['#0D4F4F', '#14897A'];

  return (
    <TouchableOpacity activeOpacity={0.92} onPress={() => onPress?.(issue.id)} style={styles.card}>
      {/* ── Body ── */}
      <View style={styles.body}>
        {/* Row 1: badges + category icon */}
        <View style={styles.badgeRow}>
          {issue.category ? (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryPillText} numberOfLines={1}>
                {issue.category}
              </Text>
            </View>
          ) : null}

          <View style={[styles.urgencyBadge, { backgroundColor: urgencyConf.bg }]}>
            <Text style={styles.urgencyText}>{urgencyConf.label}</Text>
          </View>

          <View style={styles.dayStatusBadge}>
            <Text style={styles.dayStatusText} numberOfLines={1}>
              Day {day} — {statusLabel}
            </Text>
          </View>

          <View style={{ flex: 1 }} />
          <Text style={styles.categoryIcon}>{categoryIcon}</Text>
        </View>

        {/* Row 2: title + optional thumb */}
        <View style={styles.titleRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={2}>
              {issue.title}
            </Text>
            {issue.description ? (
              <Text style={styles.desc} numberOfLines={thumbUrl ? 3 : 2}>
                {issue.description}
              </Text>
            ) : null}
          </View>

          {thumbUrl ? (
            <Image source={{ uri: thumbUrl }} style={styles.thumb} resizeMode="cover" />
          ) : null}
        </View>

        {/* Row 3: location + meta */}
        <View style={styles.metaRow}>
          <Text style={styles.metaText} numberOfLines={1}>
            📍 {location}
            {issue.isVerifiedLocation ? '  ' : ''}
          </Text>
          {issue.isVerifiedLocation ? (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>✓ Verified</Text>
            </View>
          ) : null}
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText} numberOfLines={1}>
            {timeAgo(issue.createdAt)}
          </Text>
        </View>

        {issue.creator?.name && !issue.isAnonymous ? (
          <Text style={styles.postedBy} numberOfLines={1}>
            Posted by <Text style={styles.postedByName}>{issue.creator.name}</Text>
          </Text>
        ) : null}
      </View>

      {/* ── Target official + progress bar ── */}
      {officialName || count > 0 ? (
        <View style={styles.officialBlock}>
          {officialName ? (
            <View style={styles.officialRow}>
              <View style={styles.officialAvatar}>
                <Text style={styles.officialAvatarText}>
                  {officialName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.officialText} numberOfLines={1}>
                  <Text style={styles.officialLabel}>Target: </Text>
                  <Text style={styles.officialName}>{officialName}</Text>
                  {officialTitle ? (
                    <Text style={styles.officialLabel}> ({officialTitle})</Text>
                  ) : null}
                </Text>
              </View>
              <Text style={styles.countText}>
                {fmt(displayCount)} / {fmt(goal)}
              </Text>
            </View>
          ) : null}

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={progress >= 80 ? ['#DC143C', '#E07B3A'] : ['#0D4F4F', '#14897A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${progress}%` }]}
            />
          </View>

          {!officialName ? (
            <Text style={styles.countTextRight}>
              {fmt(displayCount)} / {fmt(goal)} supporters
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.divider} />

      {/* ── Action row ── */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={(e) => {
            e.stopPropagation?.();
            onSupport?.(issue.id);
          }}
          style={{ flex: 1 }}
        >
          <LinearGradient
            colors={supportBtnColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.supportBtn}
          >
            <Text style={styles.supportBtnText}>🤝 {supported ? 'Supported ✓' : 'Support'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.85}>
          <LinearGradient
            colors={['#DC143C', '#c01234']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.escalateBtn}
          >
            <Text style={styles.escalateBtnText}>⚡ Escalate</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── Stats row ── */}
      <View style={styles.statsRow}>
        <Text style={styles.statText}>👁 {fmt(issue.viewCount || 0)}</Text>
        <Text style={styles.statText}>💬 {fmt(issue.commentCount || 0)}</Text>
        {issue.storyCount > 0 ? (
          <Text style={[styles.statText, styles.storyStat]}>📖 {fmt(issue.storyCount)}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default memo(IssueCard);

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  body: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 0 },

  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  categoryPill: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: 'rgba(13,79,79,0.3)',
  },
  categoryPillText: { fontSize: 12, fontWeight: FONTS.weight.semibold, color: COLORS.deepTeal },
  urgencyBadge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: RADIUS.pill },
  urgencyText: { fontSize: 11, fontWeight: FONTS.weight.heavy, color: '#fff', letterSpacing: 0.4 },
  dayStatusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: '#1a1a1a',
  },
  dayStatusText: { fontSize: 11, fontWeight: FONTS.weight.bold, color: '#fff' },
  categoryIcon: { fontSize: 22 },

  titleRow: { flexDirection: 'row', gap: 14, marginBottom: 8 },
  title: {
    fontSize: 16,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.textPrimary,
    lineHeight: 22,
    marginBottom: 6,
  },
  desc: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: '#f0f0ee',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  metaText: { fontSize: 12, color: '#666' },
  metaDot: { fontSize: 12, color: '#bbb' },
  verifiedBadge: {
    backgroundColor: 'rgba(20,137,122,0.1)',
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: RADIUS.pill,
  },
  verifiedText: { fontSize: 10, fontWeight: FONTS.weight.heavy, color: COLORS.teal },
  postedBy: { fontSize: 12, color: '#666', marginBottom: 14 },
  postedByName: { color: '#444', fontWeight: FONTS.weight.bold },

  officialBlock: {
    marginHorizontal: 18,
    marginBottom: 14,
    padding: 12,
    backgroundColor: '#fafaf8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  officialRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  officialAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.deepTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  officialAvatarText: { color: '#fff', fontSize: 12, fontWeight: FONTS.weight.bold },
  officialText: { fontSize: 12, color: '#333' },
  officialLabel: { color: '#888' },
  officialName: { fontWeight: FONTS.weight.bold, color: '#333' },
  countText: { fontSize: 12, fontWeight: FONTS.weight.bold, color: COLORS.deepTeal },
  countTextRight: {
    fontSize: 11,
    fontWeight: FONTS.weight.semibold,
    color: '#888',
    textAlign: 'right',
    marginTop: 4,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: RADIUS.pill },

  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginHorizontal: 18 },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    paddingHorizontal: 18,
  },
  supportBtn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportBtnText: { color: '#fff', fontSize: 14, fontWeight: FONTS.weight.bold },
  escalateBtn: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  escalateBtnText: { color: '#fff', fontSize: 13, fontWeight: FONTS.weight.bold },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingBottom: 14,
    paddingTop: 2,
  },
  statText: { fontSize: 12, color: '#888' },
  storyStat: { color: COLORS.teal, fontWeight: FONTS.weight.medium },
});
