/**
 * FilterChips (mobile) — two horizontal scroll rows:
 *   1. Category (tap to set, tap same to clear)
 *   2. Urgency | Status (divider between)
 *
 * Mirrors the web component's chips list 1:1.
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS } from '../../theme';

const CATEGORY_CHIPS = [
  { value: '', label: 'All' },
  { value: 'Infrastructure', label: '🛣️ Infrastructure' },
  { value: 'Healthcare', label: '🏥 Healthcare' },
  { value: 'Education', label: '🎓 Education' },
  { value: 'Safety', label: '🛡️ Safety' },
  { value: 'Environment', label: '🌿 Environment' },
  { value: 'Agriculture', label: '🌾 Agriculture' },
  { value: 'Corruption', label: '⚖️ Corruption' },
  { value: 'Other', label: '• Other' },
];

const URGENCY_CHIPS = [
  { value: 'critical', label: '🚨 Critical' },
  { value: 'high', label: '⚠️ High' },
  { value: 'medium', label: '● Medium' },
  { value: 'low', label: '○ Low' },
];

const STATUS_CHIPS = [
  { value: 'active', label: 'Active' },
  { value: 'trending', label: '🔥 Trending' },
  { value: 'escalated', label: '🔺 Escalated' },
  { value: 'officially_resolved', label: '✓ Resolved' },
];

function Chip({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipActive : styles.chipIdle]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function FilterChips({ filters, onUpdate }) {
  function toggle(key, value) {
    onUpdate({ [key]: filters[key] === value ? '' : value });
  }

  return (
    <View style={{ gap: 8 }}>
      {/* Category row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {CATEGORY_CHIPS.map((c) => (
          <Chip
            key={c.value || 'all'}
            label={c.label}
            selected={filters.category === c.value}
            onPress={() => onUpdate({ category: c.value })}
          />
        ))}
      </ScrollView>

      {/* Urgency | Status row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {URGENCY_CHIPS.map((c) => (
          <Chip
            key={`u-${c.value}`}
            label={c.label}
            selected={filters.urgency === c.value}
            onPress={() => toggle('urgency', c.value)}
          />
        ))}
        <View style={styles.sep} />
        {STATUS_CHIPS.map((c) => (
          <Chip
            key={`s-${c.value}`}
            label={c.label}
            selected={filters.status === c.value}
            onPress={() => toggle('status', c.value)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  chip: {
    flexShrink: 0,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
  },
  chipIdle: { borderColor: 'rgba(0,0,0,0.12)', backgroundColor: '#fff' },
  chipActive: { borderColor: COLORS.deepTeal, backgroundColor: COLORS.deepTeal },
  chipText: { fontSize: 13, color: '#333', fontWeight: FONTS.weight.medium },
  chipTextActive: { color: '#fff', fontWeight: FONTS.weight.bold },
  sep: { width: 1, backgroundColor: 'rgba(0,0,0,0.1)', marginHorizontal: 4 },
});
