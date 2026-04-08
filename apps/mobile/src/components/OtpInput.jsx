import React, { useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { View, TextInput, StyleSheet, Animated } from 'react-native';
import { COLORS, FONTS, RADIUS } from '../theme';

const OTP_LENGTH = 6;

/**
 * 6-box OTP input. Auto-advances on each digit.
 * Exposes { shake() } via ref.
 *
 * @param {{
 *   value:      string,
 *   onChange:   (otp: string) => void,
 *   hasError?:  boolean,
 * }} props
 */
const OtpInput = forwardRef(function OtpInput({ value = '', onChange, hasError = false }, ref) {
  const digits = value.split('').concat(Array(OTP_LENGTH).fill('')).slice(0, OTP_LENGTH);
  const inputs = useRef([]);
  const shakeX = useRef(new Animated.Value(0)).current;

  useImperativeHandle(ref, () => ({
    shake() {
      Animated.sequence([
        Animated.timing(shakeX, { toValue: 10, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -10, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 8, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -8, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0, duration: 55, useNativeDriver: true }),
      ]).start();
    },
    focus() {
      inputs.current[0]?.focus();
    },
  }));

  function handleChange(text, index) {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = digits.map((d, i) => (i === index ? digit : d));
    onChange(next.join(''));
    if (digit && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(e, index) {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      const next = digits.map((d, i) => (i === index - 1 ? '' : d));
      onChange(next.join(''));
    }
  }

  return (
    <Animated.View style={[styles.row, { transform: [{ translateX: shakeX }] }]}>
      {digits.map((digit, i) => (
        <TextInput
          key={i}
          ref={(el) => (inputs.current[i] = el)}
          style={[styles.box, digit && styles.boxFilled, hasError && styles.boxError]}
          value={digit}
          onChangeText={(t) => handleChange(t, i)}
          onKeyPress={(e) => handleKeyPress(e, i)}
          keyboardType="number-pad"
          maxLength={1}
          selectTextOnFocus
          caretHidden
        />
      ))}
    </Animated.View>
  );
});

export default OtpInput;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  box: {
    width: 46,
    height: 56,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
    textAlign: 'center',
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.bold,
    color: COLORS.textPrimary,
  },
  boxFilled: {
    borderColor: COLORS.teal,
    backgroundColor: 'rgba(20,137,122,0.06)',
  },
  boxError: {
    borderColor: COLORS.error,
    backgroundColor: 'rgba(220,38,38,0.05)',
  },
});
