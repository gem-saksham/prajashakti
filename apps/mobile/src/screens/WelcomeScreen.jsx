import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Logo from '../components/Logo';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../theme';

export default function WelcomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const logoAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(120)).current;
  const btnAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(logoAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    Animated.timing(cardAnim, {
      toValue: 0,
      duration: 300,
      delay: 100,
      useNativeDriver: true,
    }).start();
    Animated.timing(btnAnim, {
      toValue: 1,
      duration: 200,
      delay: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const logoScale = logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.0] });

  return (
    <LinearGradient colors={[COLORS.deepTeal, COLORS.teal]} style={styles.gradient}>
      {/* ── Logo section (top half) ── */}
      <Animated.View
        style={[
          styles.logoSection,
          { paddingTop: insets.top + SPACING.xxxl },
          { opacity: logoAnim, transform: [{ scale: logoScale }] },
        ]}
      >
        <Logo size={100} nameColor="#fff" taglineColor="rgba(255,255,255,0.65)" />
      </Animated.View>

      {/* ── Bottom card (slides up) ── */}
      <Animated.View
        style={[
          styles.card,
          { paddingBottom: insets.bottom + SPACING.xl },
          { transform: [{ translateY: cardAnim }] },
        ]}
      >
        <View style={styles.cardHandle} />
        <Text style={styles.cardHeading}>Welcome</Text>
        <Text style={styles.cardSub}>
          Hold your local government accountable.{'\n'}One citizen at a time.
        </Text>

        <Animated.View style={[styles.btns, { opacity: btnAnim }]}>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimaryText}>I'm new here — Register</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnSecondaryText}>I have an account — Login</Text>
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.footer}>
          By continuing, you agree to our Terms of Service.{'\n'}No spam. No corporate funding.
          Ever.
        </Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  logoSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    gap: 14,
    alignItems: 'center',
  },
  cardHandle: {
    width: 40,
    height: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(0,0,0,0.10)',
    marginBottom: 4,
  },
  cardHeading: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: FONTS.weight.heavy,
    alignSelf: 'flex-start',
  },
  cardSub: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.md,
    lineHeight: 22,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  btns: { width: '100%', gap: 12 },
  btnPrimary: {
    width: '100%',
    backgroundColor: COLORS.deepTeal,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
  },
  btnSecondary: {
    width: '100%',
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  btnSecondaryText: {
    color: COLORS.deepTeal,
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.semibold,
  },
  footer: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    textAlign: 'center',
    marginTop: 4,
  },
});
