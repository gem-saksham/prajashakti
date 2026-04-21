/**
 * FilterSummaryBar — horizontal strip of active-filter pills with ✕ remove.
 * Mobile port of the web FilterSummaryBar (minus copy-link and save-search,
 * which don't apply on native).
 */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS } from '../../theme';

const DATE_RANGE_LABELS = {
  day: 'Today',
  week: 'This week',
  month: 'This month',
  year: 'This year',
};

function buildPills(filters) {
  const pills = [];
  if (filters.search)
    pills.push({ key: 'search', label: `"${filters.search}"`, reset: { search: '' } });
  if (filters.category)
    pills.push({ key: 'category', label: filters.category, reset: { category: '' } });
  if (filters.urgency)
    pills.push({ key: 'urgency', label: `${filters.urgency} urgency`, reset: { urgency: '' } });
  if (filters.status)
    pills.push({
      key: 'status',
      label: filters.status.replace(/_/g, ' '),
      reset: { status: '' },
    });
  if (filters.state)
    pills.push({ key: 'state', label: filters.state, reset: { state: '', district: '' } });
  if (filters.district)
    pills.push({ key: 'district', label: filters.district, reset: { district: '' } });
  if (filters.sort && filters.sort !== 'newest')
    pills.push({
      key: 'sort',
      label: `↕ ${filters.sort.replace(/_/g, ' ')}`,
      reset: { sort: 'newest' },
    });
  if (filters.minSupport > 0)
    pills.push({
      key: 'minSupport',
      label: `≥${filters.minSupport} supporters`,
      reset: { minSupport: 0 },
    });
  if (filters.dateRange && filters.dateRange !== 'all')
    pills.push({
      key: 'dateRange',
      label: DATE_RANGE_LABELS[filters.dateRange] || filters.dateRange,
      reset: { dateRange: 'all' },
    });
  if (filters.hasPhotos)
    pills.push({ key: 'hasPhotos', label: 'Has photos', reset: { hasPhotos: false } });
  if (filters.verifiedOnly)
    pills.push({
      key: 'verifiedOnly',
      label: 'Verified location',
      reset: { verifiedOnly: false },
    });
  if (filters.lat != null && filters.lng != null)
    pills.push({
      key: 'geo',
      label: `📍 Within ${filters.radiusKm || 10} km`,
      reset: { lat: null, lng: null },
    });
  return pills;
}

export default function FilterSummaryBar({ filters, onUpdate, onClear }) {
  const pills = buildPills(filters);
  if (pills.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {pills.map((p) => (
        <View key={p.key} style={styles.pill}>
          <Text style={styles.pillText} numberOfLines={1}>
            {p.label}
          </Text>
          <TouchableOpacity onPress={() => onUpdate(p.reset)} hitSlop={8} style={styles.pillX}>
            <Text style={styles.pillXText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity onPress={onClear} activeOpacity={0.7} style={styles.clearBtn}>
        <Text style={styles.clearText}>Clear all</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingLeft: 10,
    paddingRight: 6,
    backgroundColor: 'rgba(13,79,79,0.08)',
    borderRadius: RADIUS.pill,
  },
  pillText: {
    fontSize: 12,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.deepTeal,
    maxWidth: 180,
  },
  pillX: {
    paddingHorizontal: 2,
  },
  pillXText: {
    fontSize: 11,
    color: 'rgba(13,79,79,0.55)',
    lineHeight: 14,
  },
  clearBtn: {
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  clearText: {
    fontSize: 12,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.crimson,
  },
});
