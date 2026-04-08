import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../theme';

/**
 * Phone number input with fixed +91 prefix, 10-digit validation,
 * and green checkmark when complete.
 */
export default function PhoneInput({
  value = '',
  onChangeText,
  label = 'Mobile number',
  error,
  style,
  autoFocus = false,
  onSubmitEditing,
  returnKeyType = 'done',
}) {
  const [focused, setFocused] = useState(false);
  const isComplete = value.length === 10;

  function handleChange(text) {
    onChangeText?.(text.replace(/\D/g, '').slice(0, 10));
  }

  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[styles.row, focused && styles.rowFocused, error && styles.rowError]}>
        <Text style={styles.prefix}>+91</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChange}
          placeholder="10-digit number"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="number-pad"
          returnKeyType={returnKeyType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          autoFocus={autoFocus}
          maxLength={10}
        />
        {isComplete && <Text style={styles.check}>✓</Text>}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    height: 52,
    gap: 8,
  },
  rowFocused: {
    borderColor: COLORS.teal,
    shadowColor: COLORS.teal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  rowError: {
    borderColor: COLORS.error,
  },
  prefix: {
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textSecondary,
  },
  input: {
    flex: 1,
    fontSize: FONTS.size.md,
    color: COLORS.textPrimary,
    height: '100%',
  },
  check: {
    color: COLORS.success,
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
  },
  error: {
    fontSize: FONTS.size.xs,
    color: COLORS.error,
    lineHeight: 16,
  },
});
