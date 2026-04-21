/**
 * DepartmentCard (mobile) — shows ministry / department / grievance category.
 * Mirrors apps/web/src/components/issue-detail/DepartmentCard.jsx.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../../theme';

export default function DepartmentCard({ issue }) {
  const hasAny = issue.ministry?.name || issue.department?.name || issue.grievanceCategory?.name;
  if (!hasAny) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>🏛️ Responsible Department</Text>
      <View style={{ gap: 6 }}>
        {issue.ministry?.name ? (
          <Text style={styles.row}>
            <Text style={styles.label}>Ministry: </Text>
            <Text style={styles.value}>{issue.ministry.name}</Text>
          </Text>
        ) : null}
        {issue.department?.name ? (
          <Text style={styles.row}>
            <Text style={styles.label}>Department: </Text>
            <Text style={styles.value}>{issue.department.name}</Text>
          </Text>
        ) : null}
        {issue.grievanceCategory?.name ? (
          <Text style={styles.row}>
            <Text style={styles.label}>Category: </Text>
            <Text style={styles.category}>{issue.grievanceCategory.name}</Text>
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f8fffe',
    borderWidth: 1,
    borderColor: 'rgba(14,137,122,0.15)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  heading: {
    fontSize: 13,
    fontWeight: FONTS.weight.bold,
    color: COLORS.deepTeal,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  row: { fontSize: 13, lineHeight: 20 },
  label: { color: '#888' },
  value: { color: COLORS.textPrimary, fontWeight: FONTS.weight.bold },
  category: { color: COLORS.teal, fontWeight: FONTS.weight.semibold },
});
