import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, RADIUS, SPACING } from '../theme';

/**
 * Unified button component.
 *
 * @param {{
 *   variant?: 'primary'|'secondary'|'outline'|'danger'|'ghost',
 *   size?:    'sm'|'md'|'lg',
 *   label:    string,
 *   onPress?: () => void,
 *   disabled?: boolean,
 *   loading?:  boolean,
 *   style?:    object,
 *   textStyle?: object,
 * }} props
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle,
}) {
  const isDisabled = disabled || loading;

  const paddingV = size === 'sm' ? 8 : size === 'lg' ? 18 : 14;
  const fontSize = size === 'sm' ? FONTS.size.sm : size === 'lg' ? FONTS.size.lg : FONTS.size.md;

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.85}
        style={[styles.touchable, { opacity: isDisabled ? 0.45 : 1 }, style]}
      >
        <LinearGradient
          colors={[COLORS.deepTeal, COLORS.teal]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.base, { paddingVertical: paddingV }]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={[styles.textPrimary, { fontSize }, textStyle]}>{label}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const variantStyle =
    {
      secondary: styles.secondary,
      outline: styles.outline,
      danger: styles.danger,
      ghost: styles.ghost,
    }[variant] ?? styles.secondary;

  const textColor =
    {
      secondary: '#fff',
      outline: COLORS.teal,
      danger: '#fff',
      ghost: COLORS.teal,
    }[variant] ?? '#fff';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.base,
        variantStyle,
        { paddingVertical: paddingV, opacity: isDisabled ? 0.45 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text style={[styles.text, { color: textColor, fontSize }, textStyle]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: { borderRadius: RADIUS.md },
  base: {
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    backgroundColor: COLORS.teal,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.teal,
  },
  danger: {
    backgroundColor: COLORS.crimson,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  textPrimary: {
    color: '#fff',
    fontWeight: FONTS.weight.bold,
  },
  text: {
    fontWeight: FONTS.weight.semibold,
  },
});
