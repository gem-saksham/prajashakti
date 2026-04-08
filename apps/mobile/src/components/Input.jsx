import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../theme';

/**
 * Labelled text input with focus ring, error state, and optional char counter.
 *
 * @param {{
 *   label?:       string,
 *   error?:       string,
 *   maxLength?:   number,
 *   showCount?:   boolean,
 *   style?:       object,
 *   inputStyle?:  object,
 *   [rest]:       TextInputProps,
 * }} props
 */
export default function Input({
  label,
  error,
  maxLength,
  showCount = false,
  style,
  inputStyle,
  value = '',
  ...rest
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {showCount && maxLength && (
            <Text style={[styles.count, value.length >= maxLength && styles.countMax]}>
              {value.length} / {maxLength}
            </Text>
          )}
        </View>
      ) : null}

      <TextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          error && styles.inputError,
          inputStyle,
        ]}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={maxLength}
        placeholderTextColor={COLORS.textMuted}
        {...rest}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.textPrimary,
  },
  count: {
    fontSize: FONTS.size.xs,
    color: COLORS.textMuted,
  },
  countMax: {
    color: COLORS.crimson,
  },
  input: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONTS.size.md,
    color: COLORS.textPrimary,
    minHeight: 48,
  },
  inputFocused: {
    borderColor: COLORS.teal,
    shadowColor: COLORS.teal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  error: {
    fontSize: FONTS.size.xs,
    color: COLORS.error,
    lineHeight: 16,
  },
});
