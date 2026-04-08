import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import Logo from '../components/Logo';
import { COLORS, FONTS } from '../theme';

export default function SplashScreen() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Logo size={100} nameColor="#fff" taglineColor="rgba(255,255,255,0.65)" />
      </Animated.View>
      <Text style={styles.motto}>यत्र प्रजाशक्तिः तत्र सुशासनम्</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.deepTeal,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  motto: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: FONTS.size.sm,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 8,
  },
});
