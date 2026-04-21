/**
 * RelatedIssues (mobile) — compact cards linking to related issues.
 * Fetches via issueApi.getRelated(id, 3).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { COLORS, FONTS } from '../../theme';
import { issueApi } from '../../utils/api';

const URGENCY_COLOR = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#2563eb',
  low: '#16a34a',
};

function timeAgo(dateStr) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function RelatedIssues({ issueId, onOpenIssue }) {
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    issueApi
      .getRelated(issueId, 3)
      .then((res) => {
        if (!cancelled) setIssues(res?.data ?? []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [issueId]);

  if (loading) {
    return (
      <View>
        <Text style={styles.heading}>Related Issues</Text>
        <ActivityIndicator color={COLORS.teal} />
      </View>
    );
  }

  if (!issues.length) return null;

  return (
    <View>
      <Text style={styles.heading}>Related Issues</Text>
      <View style={{ gap: 8 }}>
        {issues.map((issue) => (
          <TouchableOpacity
            key={issue.id}
            activeOpacity={0.85}
            onPress={() => onOpenIssue?.(issue.id)}
            style={styles.card}
          >
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={2}>
                {issue.title}
              </Text>
              <Text style={[styles.urgency, { color: URGENCY_COLOR[issue.urgency] ?? '#555' }]}>
                {(issue.urgency ?? '').toUpperCase()}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>
                👍 {(issue.supporterCount ?? 0).toLocaleString('en-IN')}
              </Text>
              {issue.district ? <Text style={styles.meta}>📍 {issue.district}</Text> : null}
              <Text style={styles.meta}>{timeAgo(issue.createdAt)}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: 13,
    fontWeight: FONTS.weight.bold,
    color: '#555',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  card: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  urgency: {
    fontSize: 10,
    fontWeight: FONTS.weight.bold,
    flexShrink: 0,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  meta: { fontSize: 11, color: '#888' },
});
