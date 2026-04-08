import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../theme';

function CountUp({ value = 0, duration = 500 }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (!value) {
      setDisplayed(0);
      return;
    }
    const start = Date.now();
    let raf;
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      setDisplayed(Math.round(p * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <Text style={styles.value}>{displayed}</Text>;
}

/**
 * 3-column stats row: Issues Raised | Supported | Comments
 *
 * @param {{ stats: { issuesRaised?: number, issuesSupported?: number, commentsPosted?: number } }} props
 */
export default function ProfileStats({ stats = {} }) {
  const cols = [
    { label: 'Issues', value: stats.issuesRaised ?? 0 },
    { label: 'Supported', value: stats.issuesSupported ?? 0 },
    { label: 'Comments', value: stats.commentsPosted ?? 0 },
  ];

  return (
    <View style={styles.row}>
      {cols.map((col, i) => (
        <View key={col.label} style={[styles.col, i < cols.length - 1 && styles.divider]}>
          <CountUp value={col.value} />
          <Text style={styles.label}>{col.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  col: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    gap: 4,
  },
  divider: {
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  value: {
    fontSize: 24,
    fontWeight: FONTS.weight.bold,
    color: COLORS.deepTeal,
    lineHeight: 28,
  },
  label: {
    fontSize: FONTS.size.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
