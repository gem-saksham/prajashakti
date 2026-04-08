import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { profileApi } from '../utils/api';
import { useAvatarUpload } from '../hooks/useAvatarUpload';
import { pickFromGallery, takePhoto } from '../services/imagePicker';
import Avatar from '../components/Avatar';
import Spinner from '../components/Spinner';
import ActionSheet from '../components/ActionSheet';
import ProfileStats from '../components/ProfileStats';
import ProfileCompleteness from '../components/ProfileCompleteness';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  if (role === 'leader') return { label: 'Leader ★', bg: 'rgba(220,20,60,0.14)', color: '#DC143C' };
  if (isVerified) return { label: 'Verified ✓', bg: 'rgba(20,137,122,0.14)', color: '#14897A' };
  return { label: 'Citizen', bg: 'rgba(255,255,255,0.18)', color: '#fff' };
}

function reputationTier(score) {
  if (score >= 5000)
    return { name: 'Champion', prevFloor: 1000, next: null, icon: '🏆', color: COLORS.crimson };
  if (score >= 1000)
    return { name: 'Rising Voice', prevFloor: 1000, next: 5000, icon: '🌟', color: COLORS.orange };
  if (score >= 500)
    return { name: 'Advocate', prevFloor: 500, next: 1000, icon: '🎖️', color: COLORS.teal };
  if (score >= 100)
    return { name: 'Citizen', prevFloor: 100, next: 500, icon: '🏅', color: COLORS.deepTeal };
  return { name: 'New Member', prevFloor: 0, next: 100, icon: '🌱', color: COLORS.textMuted };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { uploadAvatar, removeAvatar, isUploading, progress } = useAvatarUpload();

  const [profile, setProfile] = useState(null);
  const [activity, setActivity] = useState([]);
  const [activityPage, setActivityPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const data = await profileApi.getMe();
      setProfile(data.user ?? data);
    } catch (e) {
      console.error('[ProfileScreen] loadProfile', e);
    }
  }, []);

  const loadActivity = useCallback(
    async (page = 1) => {
      if (!user?.id) return;
      try {
        const data = await profileApi.getActivity(user.id, page);
        const raw = data.data ?? data.activity ?? data;
        const items = Array.isArray(raw) ? raw : [];
        if (page === 1) {
          setActivity(items);
        } else {
          setActivity((prev) => [...prev, ...items]);
        }
        setHasMore(items.length === 20);
        setActivityPage(page);
      } catch (e) {
        console.error('[ProfileScreen] loadActivity', e);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadProfile(), loadActivity(1)]);
      setLoading(false);
    })();
  }, [loadProfile, loadActivity]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadProfile(), loadActivity(1)]);
    setRefreshing(false);
  }, [loadProfile, loadActivity]);

  // ── Avatar picker actions ────────────────────────────────────────────────

  const pickerActions = [
    {
      icon: '📷',
      label: 'Take Photo',
      onPress: async () => {
        const img = await takePhoto();
        if (img) {
          await uploadAvatar(img);
          await loadProfile();
        }
      },
    },
    {
      icon: '🖼️',
      label: 'Choose from Gallery',
      onPress: async () => {
        const img = await pickFromGallery();
        if (img) {
          await uploadAvatar(img);
          await loadProfile();
        }
      },
    },
    ...(profile?.avatarUrl
      ? [
          {
            icon: '🗑️',
            label: 'Remove Photo',
            destructive: true,
            onPress: async () => {
              await removeAvatar();
              await loadProfile();
            },
          },
        ]
      : []),
  ];

  if (loading) {
    return (
      <View style={[styles.loader, { paddingTop: insets.top }]}>
        <Spinner />
      </View>
    );
  }

  const displayName = profile?.name ?? user?.name ?? 'You';
  const badge = roleBadge(profile?.role, profile?.isVerified);
  const repScore = profile?.reputationScore ?? 0;
  const tier = reputationTier(repScore);
  const tierPct = tier.next
    ? Math.round(((repScore - tier.prevFloor) / (tier.next - tier.prevFloor)) * 100)
    : 100;
  const location = profile?.district
    ? `${profile.district}${profile.state ? `, ${profile.state}` : ''}`
    : null;

  return (
    <>
      <ActionSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        title="Profile Photo"
        actions={pickerActions}
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.teal} />
        }
      >
        {/* ── Gradient header ── */}
        <LinearGradient
          colors={[COLORS.deepTeal, COLORS.teal]}
          style={[styles.header, { paddingTop: insets.top + 8 }]}
        >
          <View style={styles.headerRow}>
            <View style={{ width: 40 }} />
            <Text style={styles.headerTitle}>My Profile</Text>
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => navigation.navigate('Settings')}
            >
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
          </View>

          {/* Avatar with upload ring */}
          <View style={styles.avatarWrap}>
            {isUploading && (
              <View style={[styles.uploadRing, { width: 104, height: 104, borderRadius: 52 }]}>
                {progress > 0 && progress < 100 && (
                  <Text style={styles.uploadPct}>{progress}%</Text>
                )}
              </View>
            )}
            <TouchableOpacity
              onPress={() => setPickerVisible(true)}
              disabled={isUploading}
              activeOpacity={0.85}
            >
              <Avatar
                uri={profile?.avatarUrl}
                name={displayName}
                size={96}
                verified={profile?.isVerified}
              />
              <View style={styles.cameraBadge}>
                <Text style={styles.cameraIcon}>📷</Text>
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.name}>{displayName}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
          {profile?.bio ? (
            <Text style={styles.bio} numberOfLines={2}>
              {profile.bio}
            </Text>
          ) : null}
          {location ? <Text style={styles.locationText}>📍 {location}</Text> : null}
        </LinearGradient>

        {/* ── Body ── */}
        <View style={styles.body}>
          <ProfileStats
            stats={{
              issuesRaised: profile?.issuesRaised ?? 0,
              issuesSupported: profile?.issuesSupported ?? 0,
              commentsPosted: profile?.commentsPosted ?? 0,
            }}
          />

          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('EditProfile')}
            activeOpacity={0.8}
          >
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>

          <ProfileCompleteness
            score={profile?.profileCompleteness ?? 0}
            suggestions={profile?.profileSuggestions ?? []}
            onPillPress={(s) => navigation.navigate('EditProfile', { focus: s })}
          />

          {/* Reputation */}
          <View style={styles.card}>
            <Text style={styles.sectionHeading}>Reputation</Text>
            <View style={styles.repRow}>
              <Text style={styles.repIcon}>{tier.icon}</Text>
              <View style={{ gap: 2 }}>
                <Text style={[styles.repTier, { color: tier.color }]}>{tier.name}</Text>
                <Text style={styles.repScore}>{repScore} points</Text>
              </View>
            </View>
            <View style={styles.repTrack}>
              <View
                style={[
                  styles.repFill,
                  { width: `${Math.min(tierPct, 100)}%`, backgroundColor: tier.color },
                ]}
              />
            </View>
            <Text style={styles.repNext}>
              {tier.next
                ? `${tier.next - repScore} more points to next tier`
                : 'Maximum tier reached 🎉'}
            </Text>
          </View>

          {/* Recent Activity */}
          <View style={styles.card}>
            <Text style={styles.sectionHeading}>Recent Activity</Text>
            {activity.length === 0 ? (
              <Text style={styles.emptyActivity}>No activity yet. Raise your first issue!</Text>
            ) : (
              <>
                {activity.slice(0, 5).map((item, i) => (
                  <View
                    key={item.id ?? i}
                    style={[
                      styles.activityItem,
                      i < Math.min(activity.length, 5) - 1 && styles.activityBorder,
                    ]}
                  >
                    <Text style={styles.activityIcon}>{ACTIVITY_ICONS[item.type] ?? '•'}</Text>
                    <View style={styles.activityContent}>
                      <Text style={styles.activityText} numberOfLines={2}>
                        {item.description ?? item.type}
                      </Text>
                      <Text style={styles.activityTime}>
                        {timeAgo(item.createdAt ?? item.created_at)}
                      </Text>
                    </View>
                  </View>
                ))}
                {hasMore && (
                  <TouchableOpacity
                    style={styles.viewAll}
                    onPress={() => loadActivity(activityPage + 1)}
                  >
                    <Text style={styles.viewAllText}>Load more</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* Account details */}
          <View style={styles.card}>
            <Text style={styles.sectionHeading}>Account</Text>
            {[
              profile?.createdAt && [
                'Member since',
                new Date(profile.createdAt).toLocaleDateString('en-IN', {
                  month: 'long',
                  year: 'numeric',
                }),
              ],
              profile?.phone && [
                'Phone',
                `+91 ${profile.phone.slice(0, 5)}${'•'.repeat(Math.max(0, profile.phone.length - 5))}`,
              ],
              ['Aadhaar', profile?.isVerified ? '✓ Verified' : 'Not verified'],
            ]
              .filter(Boolean)
              .map(([label, val], i, arr) => (
                <View
                  key={label}
                  style={[styles.accountRow, i < arr.length - 1 && styles.accountRowBorder]}
                >
                  <Text style={styles.accountLabel}>{label}</Text>
                  <Text
                    style={[
                      styles.accountValue,
                      label === 'Aadhaar' &&
                        (profile?.isVerified ? styles.verifiedText : styles.mutedText),
                    ]}
                  >
                    {val}
                  </Text>
                </View>
              ))}
          </View>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.pageBg },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.pageBg,
  },

  header: {
    paddingBottom: 32,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.bold,
    color: 'rgba(255,255,255,0.9)',
  },
  settingsBtn: { width: 40, alignItems: 'flex-end' },
  settingsIcon: { fontSize: 22 },

  avatarWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  uploadRing: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: COLORS.teal,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  uploadPct: {
    position: 'absolute',
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.bold,
    color: '#fff',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.deepTeal,
  },
  cameraIcon: { fontSize: 13, lineHeight: 18 },

  name: { fontSize: 20, fontWeight: FONTS.weight.bold, color: '#fff', textAlign: 'center' },
  badge: { borderRadius: 99, paddingVertical: 4, paddingHorizontal: 12 },
  badgeText: { fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold },
  bio: {
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 20,
  },
  locationText: { fontSize: FONTS.size.sm, color: 'rgba(255,255,255,0.7)' },

  body: { padding: SPACING.lg, gap: SPACING.md },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: 10,
  },
  sectionHeading: {
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },

  editBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.teal,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editBtnText: { fontSize: FONTS.size.md, fontWeight: FONTS.weight.semibold, color: COLORS.teal },

  repRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  repIcon: { fontSize: 32 },
  repTier: { fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold },
  repScore: { fontSize: FONTS.size.sm, color: COLORS.textMuted },
  repTrack: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 99,
    overflow: 'hidden',
  },
  repFill: { height: 6, borderRadius: 99 },
  repNext: { fontSize: FONTS.size.sm, color: COLORS.textMuted },

  activityItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  activityBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  activityIcon: { fontSize: 18, marginTop: 1 },
  activityContent: { flex: 1, gap: 2 },
  activityText: { fontSize: FONTS.size.sm, color: COLORS.textPrimary, lineHeight: 20 },
  activityTime: { fontSize: FONTS.size.xs, color: COLORS.textMuted },
  emptyActivity: {
    fontSize: FONTS.size.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    padding: SPACING.md,
  },
  viewAll: { paddingTop: SPACING.sm, alignItems: 'center' },
  viewAllText: { fontSize: FONTS.size.sm, color: COLORS.teal, fontWeight: FONTS.weight.semibold },

  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  accountRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  accountLabel: { fontSize: FONTS.size.sm, color: COLORS.textMuted, fontWeight: '500' },
  accountValue: {
    fontSize: FONTS.size.sm,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weight.semibold,
  },
  verifiedText: { color: '#34c987' },
  mutedText: { color: COLORS.textMuted },

  logoutBtn: { alignItems: 'center', paddingVertical: SPACING.md },
  logoutText: { fontSize: FONTS.size.md, color: COLORS.crimson, fontWeight: FONTS.weight.semibold },
});
