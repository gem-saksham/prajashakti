/**
 * IssuePostCard (mobile) — the "main tweet" at the top of the issue detail feed.
 * Mirrors apps/web/src/components/issue-detail/IssuePostCard.jsx.
 *
 * Badges → title → reporter → description (w/ "Show more") → meta chips →
 * photo strip → stats row → engagement row (Support / Comment / Story / Activity / Share).
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, RADIUS } from '../../theme';
import { getDevHost, API_URL } from '../../utils/config';

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
  Infrastructure: '🏗️',
  Healthcare: '🏥',
  Education: '🎓',
  Safety: '🛡️',
  Environment: '🌱',
  Agriculture: '🌾',
  Corruption: '⚖️',
  other: '📌',
};

function fmt(n) {
  if (n == null) return '0';
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

function resolveMediaUri(url) {
  if (!url) return null;
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
  return `${API_URL}/media/${url.replace(/^\//, '')}`;
}

function Chip({ label, color, bg }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function StatPill({ icon, value, active, onPress }) {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap activeOpacity={0.7} onPress={onPress} style={styles.statPill}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, active && styles.statValueActive]}>{fmt(value)}</Text>
    </Wrap>
  );
}

function EngageBtn({ label, active, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.engBtn, active && styles.engBtnActive]}
    >
      <Text style={[styles.engBtnText, active && styles.engBtnTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
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
  const catKey = issue.category ?? 'other';
  const catIcon = CATEGORY_ICON[catKey] ?? '📌';
  const location =
    [issue.district, issue.state].filter(Boolean).join(', ') || issue.formattedAddress || '';
  const descLong = (issue.description?.length ?? 0) > 180;
  const photos = (issue.photos || []).filter((p) => p?.url);

  return (
    <View style={styles.card}>
      {/* Urgency accent bar */}
      <View style={[styles.accent, { backgroundColor: urgency.color, opacity: 0.7 }]} />

      <View style={styles.body}>
        {/* Badges + time */}
        <View style={styles.badgeRow}>
          <Chip label={`🔴 ${urgency.label}`} color={urgency.color} bg={urgency.bg} />
          <Chip label={status.label} color={status.color} bg={status.bg} />
          {issue.isCampaign ? (
            <Chip label="📣 Campaign" color="#DC143C" bg="rgba(220,20,60,0.08)" />
          ) : null}
          <View style={{ flex: 1 }} />
          <Text style={styles.timeText}>{timeAgo(issue.createdAt)}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{issue.title}</Text>

        {/* Reporter */}
        <Text style={styles.reporter} numberOfLines={2}>
          {issue.isAnonymous ? (
            'Reported anonymously'
          ) : (
            <>
              Reported by{' '}
              <Text style={styles.reporterName}>{issue.creator?.name ?? 'Citizen'}</Text>
            </>
          )}
          {issue.isVerifiedLocation ? (
            <Text style={styles.verifiedBadge}> ✓ GPS verified</Text>
          ) : null}
        </Text>

        {/* Description */}
        {issue.description ? (
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.desc} numberOfLines={expanded ? undefined : 3}>
              {issue.description}
            </Text>
            {descLong ? (
              <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.6}>
                <Text style={styles.showMore}>{expanded ? 'Show less' : 'Show more'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Meta chips */}
        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText} numberOfLines={1}>
              {catIcon} {String(catKey).replace(/_/g, ' ')}
            </Text>
          </View>
          {location ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText} numberOfLines={1}>
                📍 {location}
              </Text>
            </View>
          ) : null}
          {issue.departmentName ? (
            <View style={styles.metaChipDept}>
              <Text style={styles.metaChipTextDept} numberOfLines={1}>
                🏛 {issue.departmentName}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Photo strip */}
        {photos.length > 0 ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onTabChange('media')}
            style={styles.photoStrip}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {photos.slice(0, 4).map((p, i) => {
                const uri = resolveMediaUri(p.url);
                return (
                  <View key={i} style={styles.photoWrap}>
                    <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
                    {i === 3 && photos.length > 4 ? (
                      <View style={styles.photoOverlay}>
                        <Text style={styles.photoOverlayText}>+{photos.length - 4}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatPill icon="👥" value={issue.supporterCount ?? 0} />
        <StatPill
          icon="📖"
          value={issue.storyCount ?? 0}
          active={activeTab === 'stories'}
          onPress={() => onTabChange('stories')}
        />
        <StatPill
          icon="💬"
          value={issue.commentCount ?? 0}
          active={activeTab === 'comments'}
          onPress={() => onTabChange('comments')}
        />
        <StatPill icon="👁" value={issue.viewCount ?? 0} />
      </View>

      {/* Engagement row */}
      <View style={styles.engageRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={isSupported ? onUnsupport : onSupport}
          style={{ flex: 1, minWidth: 120 }}
        >
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

        <EngageBtn
          label="💬 Comment"
          active={activeTab === 'comments'}
          onPress={() => onTabChange('comments')}
        />
        <EngageBtn
          label="📖 Story"
          active={activeTab === 'stories'}
          onPress={() => onTabChange('stories')}
        />
        <EngageBtn
          label="⚡ Activity"
          active={activeTab === 'activity'}
          onPress={() => onTabChange('activity')}
        />
        <EngageBtn label="🔗" active={false} onPress={onShare} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  accent: { height: 4 },

  body: { paddingHorizontal: 18, paddingTop: 16 },

  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: RADIUS.pill,
  },
  chipText: { fontSize: 11, fontWeight: FONTS.weight.bold },
  timeText: { fontSize: 12, color: '#aaa' },

  title: {
    fontSize: 20,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.textPrimary,
    lineHeight: 26,
    marginBottom: 8,
  },
  reporter: { fontSize: 12, color: '#888', marginBottom: 10 },
  reporterName: { color: '#555', fontWeight: FONTS.weight.semibold },
  verifiedBadge: { color: '#16a34a', fontWeight: FONTS.weight.semibold },

  desc: { fontSize: 14, lineHeight: 22, color: '#333' },
  showMore: {
    fontSize: 13,
    color: COLORS.teal,
    fontWeight: FONTS.weight.semibold,
    paddingVertical: 4,
  },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  metaChip: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: '#f4f5f0',
  },
  metaChipText: { fontSize: 12, color: '#555' },
  metaChipDept: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(13,79,79,0.08)',
  },
  metaChipTextDept: { fontSize: 12, color: COLORS.deepTeal },

  photoStrip: { marginBottom: 14 },
  photoWrap: { marginRight: 6, position: 'relative' },
  photo: {
    width: 72,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f0ee',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOverlayText: { color: '#fff', fontWeight: FONTS.weight.bold, fontSize: 13 },

  statsRow: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  statIcon: { fontSize: 15 },
  statValue: { fontSize: 13, color: '#666' },
  statValueActive: { color: COLORS.teal, fontWeight: FONTS.weight.bold },

  engageRow: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  supportBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportBtnText: { color: '#fff', fontSize: 13, fontWeight: FONTS.weight.bold },
  supportedBtn: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.deepTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportedBtnText: {
    color: COLORS.deepTeal,
    fontSize: 13,
    fontWeight: FONTS.weight.bold,
  },

  engBtn: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: 'transparent',
  },
  engBtnActive: {
    borderColor: COLORS.teal,
    backgroundColor: 'rgba(20,137,122,0.06)',
  },
  engBtnText: { fontSize: 13, color: '#555', fontWeight: FONTS.weight.medium },
  engBtnTextActive: { color: COLORS.teal, fontWeight: FONTS.weight.bold },
});
