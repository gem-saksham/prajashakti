/**
 * SupportersList (mobile) — collapsible list of supporters.
 * Lazy-loads via supportApi.getSupporters on first expand.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { COLORS, FONTS } from '../../theme';
import { supportApi } from '../../utils/api';

function Initials({ name, size = 32 }) {
  const initials = (name ?? 'C')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const hue = ((name ?? 'C').charCodeAt(0) * 7) % 360;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `hsl(${hue}, 50%, 55%)`,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Text style={{ color: '#fff', fontSize: size * 0.38, fontWeight: '700' }}>{initials}</Text>
    </View>
  );
}

export default function SupportersList({ issueId, totalCount = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supporters, setSupporters] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!expanded || loaded) return;
    let cancelled = false;
    setLoading(true);
    supportApi
      .getSupporters(issueId, 1, 12)
      .then((res) => {
        if (!cancelled) {
          setSupporters(res?.data ?? []);
          setLoaded(true);
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [expanded, loaded, issueId]);

  const remaining = Math.max(0, totalCount - supporters.length);

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setExpanded((e) => !e)}
        style={styles.headerRow}
      >
        <Text style={styles.heading}>
          👥 Supporters
          {totalCount > 0 ? (
            <Text style={{ color: COLORS.deepTeal }}> ({totalCount.toLocaleString('en-IN')})</Text>
          ) : null}
        </Text>
        <Text style={styles.toggle}>{expanded ? '▲ Hide' : '▼ Show'}</Text>
      </TouchableOpacity>

      {expanded ? (
        <View style={{ marginTop: 12 }}>
          {loading ? (
            <ActivityIndicator color={COLORS.teal} />
          ) : supporters.length === 0 ? (
            <Text style={styles.empty}>No supporters yet — be the first!</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {supporters.map((s) => (
                <View key={s.id} style={styles.supRow}>
                  <Initials name={s.name} size={32} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.supName} numberOfLines={1}>
                      {s.name}
                      {s.isVerified ? <Text style={styles.verified}> ✓</Text> : null}
                    </Text>
                    {s.district ? (
                      <Text style={styles.supLoc} numberOfLines={1}>
                        {s.district}
                        {s.state ? `, ${s.state}` : ''}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
              {remaining > 0 ? (
                <Text style={styles.more}>+{remaining.toLocaleString('en-IN')} more</Text>
              ) : null}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    fontSize: 13,
    fontWeight: FONTS.weight.bold,
    color: '#555',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  toggle: { fontSize: 12, color: '#888' },
  empty: { fontSize: 13, color: '#888' },
  supRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  supName: { fontSize: 13, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary },
  verified: { color: '#16a34a', fontSize: 11 },
  supLoc: { fontSize: 11, color: '#888' },
  more: { fontSize: 12, color: '#888', marginTop: 4 },
});
