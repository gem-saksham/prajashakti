import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../theme';

/**
 * Reusable row for settings list.
 *
 * @param {{
 *   icon?:         string,
 *   label:         string,
 *   value?:        string,
 *   onPress?:      () => void,
 *   rightElement?: React.ReactNode,   // e.g. <Switch />
 *   destructive?:  boolean,
 *   isLast?:       boolean,
 * }} props
 */
export default function SettingsRow({
  icon,
  label,
  value,
  onPress,
  rightElement,
  destructive = false,
  isLast = false,
}) {
  const inner = (
    <View style={[styles.row, !isLast && styles.border]}>
      <View style={styles.left}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <Text style={[styles.label, destructive && styles.destructive]}>{label}</Text>
      </View>
      <View style={styles.right}>
        {value ? <Text style={styles.value}>{value}</Text> : null}
        {rightElement ?? null}
        {onPress && !rightElement ? <Text style={styles.chevron}>›</Text> : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
        {inner}
      </TouchableOpacity>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: SPACING.lg,
  },
  border: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  icon: {
    fontSize: 20,
    width: 28,
  },
  label: {
    fontSize: FONTS.size.md,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weight.medium,
    flex: 1,
  },
  destructive: {
    color: COLORS.crimson,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  value: {
    fontSize: FONTS.size.sm,
    color: COLORS.textMuted,
  },
  chevron: {
    fontSize: 22,
    color: COLORS.textMuted,
    marginTop: -1,
  },
});
