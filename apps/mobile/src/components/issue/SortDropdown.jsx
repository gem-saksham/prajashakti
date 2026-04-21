/**
 * SortDropdown (mobile) — compact button that opens an ActionSheet with the
 * same sort options as the web dropdown.
 */
import React, { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS } from '../../theme';
import ActionSheet from '../ActionSheet';

const OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'most_supported', label: 'Most supported' },
  { value: 'most_urgent', label: 'Most urgent' },
  { value: 'most_viewed', label: 'Most viewed' },
  { value: 'trending', label: 'Trending' },
  { value: 'recently_updated', label: 'Recently updated' },
  { value: 'oldest_unresolved', label: 'Oldest unresolved' },
  { value: 'oldest', label: 'Oldest first' },
];

export default function SortDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const current = OPTIONS.find((o) => o.value === value) || OPTIONS[0];

  const actions = OPTIONS.map((opt) => ({
    label: (opt.value === value ? '✓  ' : '     ') + opt.label,
    onPress: () => onChange(opt.value),
  }));

  return (
    <>
      <TouchableOpacity activeOpacity={0.85} onPress={() => setOpen(true)} style={styles.button}>
        <Text style={styles.buttonText} numberOfLines={1}>
          ↕ {current.label}
        </Text>
      </TouchableOpacity>

      <ActionSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Sort by"
        actions={actions}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: '#fff',
    maxWidth: 170,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: FONTS.weight.semibold,
    color: '#333',
  },
});
