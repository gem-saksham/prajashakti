import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../theme';

const VARIANT_STYLES = {
  default: { bg: COLORS.pageBg, text: COLORS.textSecondary },
  teal: { bg: 'rgba(20,137,122,0.1)', text: COLORS.teal },
  crimson: { bg: 'rgba(220,20,60,0.1)', text: COLORS.crimson },
  orange: { bg: 'rgba(224,123,58,0.1)', text: COLORS.orange },
  green: { bg: 'rgba(22,163,74,0.1)', text: COLORS.success },
  gray: { bg: 'rgba(0,0,0,0.06)', text: COLORS.textMuted },
};

/**
 * Small colored pill badge.
 *
 * @param {{
 *   label:     string,
 *   variant?:  'default'|'teal'|'crimson'|'orange'|'green'|'gray',
 *   style?:    object,
 * }} props
 */
export default function Badge({ label, variant = 'default', style }) {
  const { bg, text } = VARIANT_STYLES[variant] ?? VARIANT_STYLES.default;

  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.semibold,
    lineHeight: 16,
  },
});
