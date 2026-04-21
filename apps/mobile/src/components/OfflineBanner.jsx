/**
 * OfflineBanner — thin status strip shown when the device has no network.
 * Mount it near the top of any screen that needs to surface offline state.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetworkState } from '../hooks/useNetworkState';
import { COLORS, FONTS } from '../theme';

export default function OfflineBanner() {
  const { isConnected } = useNetworkState();
  if (isConnected) return null;
  return (
    <View style={styles.bar} accessibilityRole="alert">
      <Text style={styles.text}>
        📡 Offline — showing cached issues. Actions will sync when you're back online.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: COLORS.crimson,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 11,
    fontWeight: FONTS.weight.semibold,
  },
});
