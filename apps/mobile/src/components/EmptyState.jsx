import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';
import Button from './Button';

/**
 * Full-width empty state with icon, title, subtitle and optional CTA.
 *
 * @param {{
 *   icon?:       string,
 *   title:       string,
 *   subtitle?:   string,
 *   ctaLabel?:   string,
 *   onCta?:      () => void,
 *   style?:      object,
 * }} props
 */
export default function EmptyState({ icon, title, subtitle, ctaLabel, onCta, style }) {
  return (
    <View style={[styles.wrap, style]}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {ctaLabel && onCta ? (
        <Button label={ctaLabel} onPress={onCta} variant="primary" size="md" style={styles.btn} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxxl,
    paddingVertical: SPACING.xxxl,
    gap: SPACING.md,
  },
  icon: {
    fontSize: 48,
    marginBottom: 4,
  },
  title: {
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    marginTop: SPACING.sm,
    paddingHorizontal: 32,
    alignSelf: 'center',
  },
});
