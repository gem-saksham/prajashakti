import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING } from '../theme';

/**
 * Teal gradient header with safe-area top padding.
 *
 * @param {{
 *   title:        string,
 *   subtitle?:    string,
 *   onBack?:      () => void,
 *   right?:       React.ReactNode,
 *   transparent?: boolean,
 * }} props
 */
export default function ScreenHeader({ title, subtitle, onBack, right, transparent = false }) {
  const insets = useSafeAreaInsets();

  const content = (
    <View style={[styles.inner, { paddingTop: insets.top + SPACING.sm }]}>
      {/* Left — back button */}
      <View style={styles.side}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Center */}
      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {/* Right */}
      <View style={styles.side}>{right ?? null}</View>
    </View>
  );

  if (transparent) {
    return <View style={[styles.wrap, styles.transparent]}>{content}</View>;
  }

  return (
    <LinearGradient
      colors={[COLORS.deepTeal, COLORS.teal]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.wrap}
    >
      {content}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  transparent: {
    backgroundColor: 'transparent',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  side: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  backBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: FONTS.size.xl,
    color: '#fff',
    fontWeight: FONTS.weight.medium,
  },
  title: {
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 1,
  },
});
