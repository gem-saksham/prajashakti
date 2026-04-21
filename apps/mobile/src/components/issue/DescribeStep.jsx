import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, SPACING, RADIUS } from '../../theme';
import { aiApi } from '../../utils/api';

const CATEGORIES = [
  { id: 'Infrastructure', label: 'Infrastructure', emoji: '🛣️' },
  { id: 'Healthcare', label: 'Healthcare', emoji: '🏥' },
  { id: 'Education', label: 'Education', emoji: '📚' },
  { id: 'Safety', label: 'Safety', emoji: '🚨' },
  { id: 'Environment', label: 'Environment', emoji: '🌳' },
  { id: 'Agriculture', label: 'Agriculture', emoji: '🌾' },
  { id: 'Corruption', label: 'Corruption', emoji: '⚖️' },
  { id: 'Other', label: 'Other', emoji: '📌' },
];

const URGENCIES = [
  {
    id: 'low',
    label: 'Low',
    color: '#888',
    bg: 'rgba(136,136,136,0.1)',
    desc: 'Minor issue, no immediate danger',
  },
  {
    id: 'medium',
    label: 'Medium',
    color: '#2B7CB8',
    bg: 'rgba(43,124,184,0.1)',
    desc: 'Significant inconvenience to residents',
  },
  {
    id: 'high',
    label: 'High',
    color: COLORS.orange,
    bg: 'rgba(224,123,58,0.1)',
    desc: 'Serious impact on daily life',
  },
  {
    id: 'critical',
    label: 'Critical',
    color: COLORS.crimson,
    bg: 'rgba(220,20,60,0.1)',
    desc: 'Immediate danger to life or property',
  },
];

function CharCounter({ current, max, minGood = null }) {
  const pct = current / max;
  let color = COLORS.teal;
  if (pct > 0.95) color = COLORS.crimson;
  else if (pct > 0.8) color = COLORS.orange;
  else if (minGood && current < minGood) color = COLORS.textMuted;
  return (
    <Text style={[styles.counter, { color }]}>
      {current} / {max}
    </Text>
  );
}

export default function DescribeStep({ draft, onUpdate, location }) {
  const titleRef = useRef(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [titleFocused, setTitleFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  function selectCategory(id) {
    Haptics.selectionAsync().catch(() => {});
    onUpdate({ category: id });
  }

  function selectUrgency(id) {
    Haptics.selectionAsync().catch(() => {});
    onUpdate({ urgency: id });
  }

  async function handleAiDraft() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAiOpen(true);
    setAiLoading(true);
    setAiError('');
    setAiResult('');
    try {
      const res = await aiApi.generateDraft({
        title: draft.title,
        category: draft.category,
        district: location?.district,
        state: location?.state,
      });
      setAiResult(res.data.description);
    } catch (err) {
      setAiError(
        err?.error?.message || 'Could not generate draft. Please write your own description.',
      );
    } finally {
      setAiLoading(false);
    }
  }

  function acceptDraft() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onUpdate({ description: aiResult });
    setAiOpen(false);
    setAiResult('');
  }

  const titleTooShort = draft.title.length > 0 && draft.title.length < 10;
  const descTooShort = draft.description.length > 0 && draft.description.length < 20;
  const aiDisabled = draft.title.length < 5;

  return (
    <View style={styles.root}>
      <View style={styles.tip}>
        <Text style={styles.tipText}>
          💡 <Text style={styles.tipBold}>Tip:</Text> Specific titles get more support. Try "Pothole
          on MG Road since June" instead of "Bad road".
        </Text>
      </View>

      {/* Title */}
      <View>
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            Issue Title <Text style={styles.required}>*</Text>
          </Text>
          <CharCounter current={draft.title.length} max={200} minGood={10} />
        </View>
        <TextInput
          ref={titleRef}
          value={draft.title}
          onChangeText={(v) => onUpdate({ title: v.slice(0, 200) })}
          onFocus={() => setTitleFocused(true)}
          onBlur={() => setTitleFocused(false)}
          placeholder="What is the issue? Be specific and brief."
          placeholderTextColor={COLORS.textMuted}
          maxLength={200}
          accessibilityLabel="Issue title"
          style={[styles.input, titleFocused && styles.inputFocus]}
        />
        {titleTooShort && (
          <Text style={styles.errorText}>Title must be at least 10 characters</Text>
        )}
      </View>

      {/* Description */}
      <View>
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            Description <Text style={styles.required}>*</Text>
          </Text>
          <CharCounter current={draft.description.length} max={2000} minGood={20} />
        </View>
        <TextInput
          value={draft.description}
          onChangeText={(v) => onUpdate({ description: v.slice(0, 2000) })}
          onFocus={() => setDescFocused(true)}
          onBlur={() => setDescFocused(false)}
          placeholder="Describe the issue in detail. What, where, since when, who is affected?"
          placeholderTextColor={COLORS.textMuted}
          maxLength={2000}
          multiline
          textAlignVertical="top"
          accessibilityLabel="Issue description"
          style={[styles.textarea, descFocused && styles.inputFocus]}
        />
        {descTooShort && (
          <Text style={styles.errorText}>Description must be at least 20 characters</Text>
        )}

        <TouchableOpacity
          onPress={handleAiDraft}
          disabled={aiDisabled}
          activeOpacity={0.7}
          accessibilityLabel="Generate AI draft description"
          style={[styles.aiBtn, aiDisabled && styles.aiBtnDisabled]}
        >
          <Text style={[styles.aiBtnText, aiDisabled && styles.aiBtnTextDisabled]}>
            ✨ Help me describe this
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category */}
      <View>
        <Text style={[styles.label, { marginBottom: 10 }]}>
          Category <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => {
            const selected = draft.category === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => selectCategory(cat.id)}
                activeOpacity={0.7}
                accessibilityLabel={`Category ${cat.label}`}
                accessibilityState={{ selected }}
                style={[styles.categoryCell, selected && styles.categoryCellSelected]}
              >
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <Text style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Urgency */}
      <View>
        <Text style={[styles.label, { marginBottom: 10 }]}>Urgency Level</Text>
        <View style={styles.urgencyRow}>
          {URGENCIES.map((u) => {
            const selected = draft.urgency === u.id;
            return (
              <TouchableOpacity
                key={u.id}
                onPress={() => selectUrgency(u.id)}
                activeOpacity={0.7}
                accessibilityLabel={`Urgency ${u.label}`}
                accessibilityState={{ selected }}
                style={[
                  styles.urgencyChip,
                  {
                    borderColor: selected ? u.color : 'rgba(0,0,0,0.1)',
                    backgroundColor: selected ? u.bg : '#fff',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.urgencyLabel,
                    {
                      color: selected ? u.color : COLORS.textSecondary,
                      fontWeight: selected ? FONTS.weight.bold : FONTS.weight.medium,
                    },
                  ]}
                >
                  {u.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {draft.urgency && (
          <Text style={styles.urgencyDesc}>
            {URGENCIES.find((u) => u.id === draft.urgency)?.desc}
          </Text>
        )}
      </View>

      {/* AI Modal */}
      <Modal
        visible={aiOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setAiOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setAiOpen(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✨ AI Draft</Text>
              <TouchableOpacity onPress={() => setAiOpen(false)} hitSlop={10}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {aiLoading && (
                <View style={styles.modalLoading}>
                  <ActivityIndicator color={COLORS.teal} size="large" />
                  <Text style={styles.modalLoadingText}>Generating a draft description…</Text>
                </View>
              )}

              {!!aiError && !aiLoading && (
                <View style={styles.modalError}>
                  <Text style={styles.modalErrorText}>{aiError}</Text>
                </View>
              )}

              {!!aiResult && !aiLoading && (
                <View style={styles.modalResult}>
                  <Text style={styles.modalResultText}>{aiResult}</Text>
                </View>
              )}
            </ScrollView>

            {!!aiResult && !aiLoading && (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalPrimary}
                  activeOpacity={0.85}
                  onPress={acceptDraft}
                >
                  <LinearGradient
                    colors={[COLORS.deepTeal, COLORS.teal]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalPrimaryGrad}
                  >
                    <Text style={styles.modalPrimaryText}>Use this draft</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSecondary}
                  activeOpacity={0.7}
                  onPress={handleAiDraft}
                >
                  <Text style={styles.modalSecondaryText}>Try again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACING.xxl },

  tip: {
    backgroundColor: 'rgba(20,137,122,0.07)',
    borderRadius: RADIUS.sm + 2,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  tipText: { fontSize: FONTS.size.sm, color: COLORS.teal, lineHeight: 20 },
  tipBold: { fontWeight: FONTS.weight.bold },

  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  label: {
    fontSize: FONTS.size.sm + 1,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textPrimary,
  },
  required: { color: COLORS.crimson },
  counter: { fontSize: 11, fontWeight: FONTS.weight.semibold },

  input: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: RADIUS.md,
    fontSize: 16,
    fontWeight: FONTS.weight.medium,
    color: COLORS.textPrimary,
    backgroundColor: '#f8f8f6',
  },
  textarea: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: RADIUS.md,
    fontSize: FONTS.size.sm + 1,
    color: COLORS.textPrimary,
    backgroundColor: '#f8f8f6',
    minHeight: 110,
    lineHeight: 22,
  },
  inputFocus: { borderColor: COLORS.teal },

  errorText: {
    fontSize: 12,
    color: '#e05555',
    marginTop: 4,
  },

  aiBtn: {
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(20,137,122,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(20,137,122,0.25)',
    borderRadius: RADIUS.pill,
  },
  aiBtnDisabled: {
    backgroundColor: '#f0f0ee',
    borderColor: 'transparent',
  },
  aiBtnText: {
    fontSize: 13,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.teal,
  },
  aiBtnTextDisabled: { color: '#aaa' },

  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryCell: {
    width: '48.5%',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  categoryCellSelected: {
    borderColor: COLORS.teal,
    backgroundColor: 'rgba(20,137,122,0.08)',
  },
  categoryEmoji: { fontSize: 20 },
  categoryLabel: {
    fontSize: 13,
    fontWeight: FONTS.weight.medium,
    color: '#333',
  },
  categoryLabelSelected: {
    fontWeight: FONTS.weight.bold,
    color: COLORS.deepTeal,
  },

  urgencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  urgencyChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
  },
  urgencyLabel: { fontSize: 13 },
  urgencyDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 6,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xxl + 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: FONTS.weight.heavy,
    color: COLORS.deepTeal,
  },
  modalClose: {
    fontSize: 20,
    color: COLORS.textMuted,
    padding: 4,
  },

  modalLoading: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  modalLoadingText: {
    marginTop: SPACING.md,
    fontSize: 14,
    color: COLORS.textMuted,
  },

  modalError: {
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: 'rgba(220,20,60,0.2)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  modalErrorText: { fontSize: 14, color: '#c0392b', lineHeight: 20 },

  modalResult: {
    backgroundColor: 'rgba(20,137,122,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(20,137,122,0.2)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  modalResultText: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.textPrimary,
  },

  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SPACING.lg,
  },
  modalPrimary: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  modalPrimaryGrad: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: FONTS.weight.bold,
  },
  modalSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.pageBg,
    borderRadius: 10,
    justifyContent: 'center',
  },
  modalSecondaryText: {
    fontSize: 13,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textSecondary,
  },
});
