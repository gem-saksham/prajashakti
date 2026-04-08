import React, { useRef } from 'react';
import { View, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../theme';

/**
 * White card with optional press-to-scale animation.
 *
 * @param {{
 *   onPress?:  () => void,
 *   style?:    object,
 *   children?: React.ReactNode,
 *   padding?:  number,
 * }} props
 */
export default function Card({ onPress, style, children, padding = SPACING.lg }) {
  const scale = useRef(new Animated.Value(1)).current;

  function onPressIn() {
    Animated.spring(scale, { toValue: 0.975, useNativeDriver: true, speed: 30 }).start();
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  }

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <Animated.View style={[styles.card, { padding, transform: [{ scale }] }, style]}>
          {children}
        </Animated.View>
      </TouchableOpacity>
    );
  }

  return <View style={[styles.card, { padding }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
});
