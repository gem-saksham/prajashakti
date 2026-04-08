import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

/**
 * Wrapper around ActivityIndicator that defaults to the brand teal color.
 *
 * @param {{ size?: 'small'|'large', color?: string, style?: object }} props
 */
export default function Spinner({ size = 'large', color = COLORS.teal, style }) {
  return (
    <View style={[styles.wrap, style]}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
});
