/**
 * ReviewStep — final review before submit.
 *
 * Shows: photo strip, title + description, location, category + urgency,
 * auto-loaded department suggestion (with option to change).
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, SPACING, RADIUS } from '../../theme';
import { issueApi } from '../../utils/api';

const URGENCY_META = {
  low: { color: '#888', bg: 'rgba(136,136,136,0.1)', label: 'Low' },
  medium: { color: '#2B7CB8', bg: 'rgba(43,124,184,0.1)', label: 'Medium' },
  high: { color: COLORS.orange, bg: 'rgba(224,123,58,0.1)', label: 'High' },
  critical: { color: COLORS.crimson, bg: 'rgba(220,20,60,0.1)', label: 'Critical' },
};

export default function ReviewStep({ draft, onUpdate, onJumpTo }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    if (draft.departmentId || draft.ministryId) return;
    if (!draft.title || draft.title.length < 5) return;
    fetchedRef.current = true;

    setLoading(true);
    issueApi
      .suggestTags({
        title: draft.title,
        description: draft.description || draft.title,
        category: draft.category,
        location_lat: draft.location?.lat,
        location_lng: draft.location?.lng,
      })
      .then((res) => {
        const { departments = [], ministries = [] } = res.suggestions || {};
        let cards = departments.slice(0, 3).map((d) => ({
          ministryId: d.ministry?.id || null,
          ministryName: d.ministry?.name || null,
          departmentId: d.id,
          departmentName: d.name,
        }));
        if (cards.length === 0 && ministries.length > 0) {
          cards = ministries.slice(0, 3).map((m) => ({
            ministryId: m.id,
            ministryName: m.name,
            departmentId: null,
            departmentName: null,
          }));
        }
        setSuggestions(cards);
        if (cards[0] && !draft.ministryId) {
          onUpdate({
            ministryId: cards[0].ministryId,
            departmentId: cards[0].departmentId,
            departmentName: cards[0].departmentName || cards[0].ministryName,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectDept(tag) {
    Haptics.selectionAsync().catch(() => {});
    onUpdate({
      ministryId: tag.ministryId,
      departmentId: tag.departmentId,
      departmentName: tag.departmentName || tag.ministryName,
    });
  }

  const photos = draft.photos || [];
  const urgency = URGENCY_META[draft.urgency] || URGENCY_META.medium;
  const selectedDeptId = draft.departmentId || draft.ministryId;

  return (
    <View style={styles.root}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          ✅ <Text style={styles.bannerBold}>Almost done!</Text> Review below and publish when
          ready.
        </Text>
      </View>

      {/* Photo strip */}
      {photos.length > 0 && (
        <Section
          title="Photo evidence"
          count={`${photos.length} photo${photos.length === 1 ? '' : 's'}`}
          onEdit={() => onJumpTo?.(1)}
        >
          <View style={styles.photoStrip}>
            {photos.map((p) => (
              <View key={p.id} style={styles.stripCell}>
                {p.uri ? (
                  <Image source={{ uri: p.uri }} style={styles.stripImg} />
                ) : (
                  <View style={[styles.stripImg, styles.stripFallback]}>
                    <Text>🖼️</Text>
                  </View>
                )}
                {p.exifGps ? (
                  <View style={styles.stripBadge}>
                    <Text style={styles.stripBadgeText}>📍</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </Section>
      )}

      {/* Title + description */}
      <Section title="What" onEdit={() => onJumpTo?.(2)}>
        <Text style={styles.titleText}>{draft.title}</Text>
        <Text style={styles.descText}>{draft.description}</Text>
      </Section>

      {/* Category + urgency */}
      <Section title="Category & urgency" onEdit={() => onJumpTo?.(2)}>
        <View style={styles.chipRow}>
          <View style={styles.catChip}>
            <Text style={styles.catChipText}>{draft.category || '—'}</Text>
          </View>
          <View
            style={[
              styles.urgencyChip,
              { backgroundColor: urgency.bg, borderColor: urgency.color },
            ]}
          >
            <Text style={[styles.urgencyChipText, { color: urgency.color }]}>
              {urgency.label} priority
            </Text>
          </View>
        </View>
      </Section>

      {/* Location */}
      <Section title="Where" onEdit={() => onJumpTo?.(3)}>
        {draft.location?.lat ? (
          <>
            <Text style={styles.locText}>
              📍{' '}
              {draft.location.displayName ||
                `${draft.location.lat.toFixed(4)}, ${draft.location.lng.toFixed(4)}`}
            </Text>
            {(draft.location.district || draft.location.state) && (
              <Text style={styles.locSub}>
                {[draft.location.district, draft.location.state, draft.location.pincode]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.locMissing}>Location required — tap Edit to set</Text>
        )}
      </Section>

      {/* Department */}
      <Section title="Responsible department" subtitle="optional">
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={COLORS.teal} size="small" />
            <Text style={styles.loadingText}>Finding department…</Text>
          </View>
        ) : suggestions.length > 0 ? (
          <View style={{ gap: 8 }}>
            {suggestions.map((tag, i) => {
              const id = tag.departmentId || tag.ministryId;
              const isSelected = selectedDeptId === id;
              return (
                <TouchableOpacity
                  key={`${id}-${i}`}
                  onPress={() => selectDept(tag)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={[styles.deptRow, isSelected && styles.deptRowSelected]}
                >
                  <Text style={styles.deptIcon}>🏛️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deptName}>{tag.ministryName || tag.departmentName}</Text>
                    {tag.departmentName && tag.ministryName ? (
                      <Text style={styles.deptSub}>{tag.departmentName}</Text>
                    ) : null}
                  </View>
                  {isSelected ? (
                    <View style={styles.checkDot}>
                      <Text style={styles.checkMark}>✓</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <Text style={styles.deptMissing}>
            We couldn't auto-detect a department. Your issue will still be routed when it gains
            traction.
          </Text>
        )}
      </Section>

      {/* Final note */}
      <View style={styles.finalNote}>
        <Text style={styles.finalNoteText}>
          By publishing, you confirm this issue is accurate to the best of your knowledge. False
          reports may be removed.
        </Text>
      </View>
    </View>
  );
}

function Section({ title, subtitle, count, onEdit, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
          {count ? <Text style={styles.sectionCount}>· {count}</Text> : null}
        </View>
        {onEdit ? (
          <TouchableOpacity
            onPress={onEdit}
            activeOpacity={0.7}
            hitSlop={8}
            accessibilityLabel={`Edit ${title}`}
          >
            <Text style={styles.sectionEdit}>Edit</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACING.lg },

  banner: {
    backgroundColor: 'rgba(20,137,122,0.08)',
    borderRadius: RADIUS.sm + 2,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bannerText: { fontSize: FONTS.size.sm, color: COLORS.teal, lineHeight: 20 },
  bannerBold: { fontWeight: FONTS.weight.bold },

  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: FONTS.weight.bold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORS.textMuted,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: FONTS.weight.medium,
  },
  sectionCount: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  sectionEdit: {
    fontSize: 12,
    fontWeight: FONTS.weight.bold,
    color: COLORS.teal,
  },

  photoStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stripCell: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  stripImg: { width: '100%', height: '100%' },
  stripFallback: {
    backgroundColor: '#f0f0ee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(20,137,122,0.9)',
    borderRadius: 9,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripBadgeText: { fontSize: 10, color: '#fff' },

  titleText: {
    fontSize: 16,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  descText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(13,79,79,0.08)',
    borderRadius: RADIUS.pill,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: FONTS.weight.bold,
    color: COLORS.deepTeal,
  },
  urgencyChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
  },
  urgencyChipText: {
    fontSize: 12,
    fontWeight: FONTS.weight.bold,
  },

  locText: {
    fontSize: 14,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textPrimary,
  },
  locSub: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  locMissing: {
    fontSize: 13,
    color: COLORS.crimson,
    fontWeight: FONTS.weight.semibold,
  },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  loadingText: { fontSize: 13, color: COLORS.textMuted },

  deptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: '#fafaf7',
  },
  deptRowSelected: {
    borderColor: COLORS.teal,
    backgroundColor: 'rgba(20,137,122,0.06)',
  },
  deptIcon: { fontSize: 20 },
  deptName: {
    fontSize: 13,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textPrimary,
  },
  deptSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  checkDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#fff',
    fontSize: 11,
    fontWeight: FONTS.weight.bold,
  },
  deptMissing: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },

  finalNote: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  finalNoteText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
