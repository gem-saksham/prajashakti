import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import SkeletonCard from '../components/SkeletonCard';
import { useAuth } from '../context/AuthContext';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';

export default function FeedScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  function goToProfile() {
    // navigate to the Profile tab
    navigation.getParent()?.navigate('ProfileTab');
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="प्रजाशक्ति" subtitle="POWER OF THE CITIZENS" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Coming soon banner — matches web FeedPlaceholder exactly */}
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>📢</Text>
          <Text style={styles.bannerTitle}>Issue Feed — Coming in Sprint 3</Text>
          <Text style={styles.bannerSub}>
            The civic issues feed, escalation system, and RTI generator are being built. Below is a
            preview of what's coming.
          </Text>
          <TouchableOpacity style={styles.profileBtn} onPress={goToProfile} activeOpacity={0.85}>
            <Text style={styles.profileBtnText}>Complete your profile →</Text>
          </TouchableOpacity>
        </View>

        {/* Skeleton preview label */}
        <Text style={styles.previewLabel}>PREVIEW — ISSUE CARDS WILL LOOK LIKE THIS</Text>

        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.pageBg },
  scroll: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  banner: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: '28px 24px',
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  bannerIcon: {
    fontSize: 52,
    marginBottom: 12,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.deepTeal,
    marginBottom: 8,
    textAlign: 'center',
  },
  bannerSub: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: 20,
  },
  profileBtn: {
    backgroundColor: COLORS.deepTeal,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: RADIUS.sm,
  },
  profileBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: FONTS.weight.semibold,
  },
  previewLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: FONTS.weight.bold,
    letterSpacing: 0.5,
    paddingLeft: 4,
  },
});
