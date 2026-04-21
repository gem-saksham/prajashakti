/**
 * SubmitOverlay — full-screen overlay shown during issue submission.
 *
 * States:
 *   - "submitting" — spinner + per-photo upload progress bars
 *   - "success"    — animated check + Share / View issue / Home buttons
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Share,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, SPACING, RADIUS } from '../../theme';

function UploadRow({ photo }) {
  const animVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animVal, {
      toValue: photo.progress ?? 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [photo.progress, animVal]);

  const width = animVal.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const status = photo.status || 'pending';
  const done = status === 'done';
  const failed = status === 'failed';

  return (
    <View style={styles.uploadRow}>
      <Text style={styles.uploadIcon}>{done ? '✓' : failed ? '✕' : '·'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.uploadName} numberOfLines={1}>
          {photo.name || 'Photo'}
        </Text>
        <View style={styles.uploadTrack}>
          <Animated.View
            style={[
              styles.uploadFill,
              {
                width,
                backgroundColor: failed ? COLORS.crimson : done ? COLORS.teal : COLORS.orange,
              },
            ]}
          />
        </View>
      </View>
      <Text style={styles.uploadPct}>
        {done ? 'Done' : failed ? 'Failed' : `${Math.round(photo.progress ?? 0)}%`}
      </Text>
    </View>
  );
}

export default function SubmitOverlay({
  state,
  photos = [],
  issueId,
  issueTitle,
  onViewIssue,
  onHome,
  onRetry,
  error,
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 80,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [state, scaleAnim]);

  async function handleShare() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const message = [
      `I just raised an issue on PrajaShakti: "${issueTitle}"`,
      'Support it to hold officials accountable.',
      issueId ? `Issue ID: ${issueId}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
    try {
      await Share.share({ message });
    } catch {
      // User cancelled or share unavailable
    }
  }

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        {state === 'submitting' && (
          <View style={styles.card}>
            <ActivityIndicator size="large" color={COLORS.teal} />
            <Text style={styles.title}>Publishing your issue…</Text>
            <Text style={styles.sub}>
              {photos.length > 0
                ? `Uploading ${photos.length} photo${photos.length === 1 ? '' : 's'}`
                : 'Finalizing…'}
            </Text>
            {photos.length > 0 && (
              <View style={styles.uploadList}>
                {photos.map((p) => (
                  <UploadRow key={p.id} photo={p} />
                ))}
              </View>
            )}
          </View>
        )}

        {state === 'error' && (
          <View style={styles.card}>
            <View style={styles.errorIconWrap}>
              <Text style={styles.errorIcon}>⚠️</Text>
            </View>
            <Text style={styles.title}>Couldn't publish</Text>
            <Text style={styles.sub}>
              {error || 'Something went wrong. Your draft is saved — try again.'}
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.7}
                onPress={onHome}
                accessibilityLabel="Go home"
              >
                <Text style={styles.secondaryBtnText}>Home</Text>
              </TouchableOpacity>
              {onRetry ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={onRetry}
                  style={{ flex: 1 }}
                  accessibilityLabel="Retry submit"
                >
                  <LinearGradient
                    colors={[COLORS.deepTeal, COLORS.teal]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryBtn}
                  >
                    <Text style={styles.primaryBtnText}>Retry</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}

        {state === 'success' && (
          <View style={styles.card}>
            <Animated.View style={[styles.successBadge, { transform: [{ scale: scaleAnim }] }]}>
              <Text style={styles.successMark}>✓</Text>
            </Animated.View>
            <Text style={styles.title}>Issue published!</Text>
            <Text style={styles.sub}>Your issue is live. Share it to gather support quickly.</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.7}
                onPress={onHome}
                accessibilityLabel="Back to feed"
              >
                <Text style={styles.secondaryBtnText}>Feed</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.7}
                onPress={handleShare}
                accessibilityLabel="Share issue"
              >
                <Text style={styles.secondaryBtnText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onViewIssue}
                style={{ flex: 1 }}
                accessibilityLabel="View issue"
              >
                <LinearGradient
                  colors={[COLORS.deepTeal, COLORS.teal]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryBtn}
                >
                  <Text style={styles.primaryBtnText}>View issue</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(13,79,79,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: SPACING.md,
  },

  title: {
    fontSize: 18,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.deepTeal,
    textAlign: 'center',
  },
  sub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },

  uploadList: {
    width: '100%',
    gap: 10,
    marginTop: SPACING.md,
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadIcon: {
    fontSize: 14,
    width: 16,
    textAlign: 'center',
    color: COLORS.textMuted,
  },
  uploadName: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 3,
  },
  uploadTrack: {
    height: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(0,0,0,0.07)',
    overflow: 'hidden',
  },
  uploadFill: {
    height: '100%',
    borderRadius: 99,
  },
  uploadPct: {
    fontSize: 11,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textMuted,
    width: 38,
    textAlign: 'right',
  },

  successBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.teal,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.teal,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 8,
  },
  successMark: {
    color: '#fff',
    fontSize: 44,
    fontWeight: FONTS.weight.heavy,
  },

  errorIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(220,20,60,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIcon: { fontSize: 40 },

  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: SPACING.md,
    width: '100%',
  },
  secondaryBtn: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textSecondary,
  },
  primaryBtn: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: FONTS.weight.heavy,
  },
});
