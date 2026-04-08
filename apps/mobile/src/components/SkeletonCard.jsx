import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '../theme';

function Bone({ width = '100%', height = 14, style }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 750, useNativeDriver: true }),
      ]),
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <Animated.View style={[styles.bone, { width, height, borderRadius: 6, opacity }, style]} />
  );
}

export default function SkeletonCard() {
  return (
    <View style={styles.card}>
      {/* Title + badge row */}
      <View style={styles.row}>
        <Bone width="60%" height={16} />
        <Bone width={52} height={22} style={styles.pill} />
      </View>

      {/* Body text lines */}
      <Bone width="90%" height={12} />
      <Bone width="75%" height={12} />

      {/* Stats pills */}
      <View style={styles.pillsRow}>
        <Bone width={64} height={22} style={styles.pill} />
        <Bone width={64} height={22} style={styles.pill} />
        <Bone width={64} height={22} style={styles.pill} />
      </View>

      {/* Progress bar */}
      <Bone width="100%" height={6} style={styles.pill} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    gap: 12,
  },
  bone: {
    backgroundColor: '#ececec',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  pill: {
    borderRadius: 99,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
});
