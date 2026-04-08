import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import OtpInput from '../components/OtpInput';
import Button from '../components/Button';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../utils/api';
import { useCountdown } from '../hooks/useCountdown';
import { formatPhone } from '../utils/format';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';

const RESEND_SECS = 30;

export default function VerifyOtpScreen({ route, navigation }) {
  const { phone, name, flow, debugOtp } = route.params ?? {};
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { login } = useAuth();
  const otpRef = useRef(null);

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpErrMsg, setOtpErrMsg] = useState('');

  const { seconds, isFinished, reset: resetTimer } = useCountdown(RESEND_SECS);

  // ── Clipboard polling (Android OTP hint) ────────────────────────────────────
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const text = await Clipboard.getStringAsync();
        const match = text?.match(/\b(\d{6})\b/);
        if (match && match[1] !== otp) {
          setOtp(match[1]);
          await Clipboard.setStringAsync('');
        }
      } catch {
        /* ignore */
      }
    }, 1500);
    return () => clearInterval(id);
  }, [otp]);

  // ── Auto-submit on 6 digits ──────────────────────────────────────────────────
  useEffect(() => {
    if (otp.length === 6) handleVerify(otp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  // ── Verify ───────────────────────────────────────────────────────────────────
  const handleVerify = useCallback(
    async (code) => {
      if ((code ?? otp).length !== 6 || loading) return;
      setLoading(true);
      setOtpErrMsg('');
      try {
        const res = await authApi.verifyOtp(phone, code ?? otp);
        show({ message: 'Welcome to प्रजाशक्ति! 🎉', type: 'success' });
        await login(res.accessToken, res.user, res.refreshToken);
      } catch (err) {
        otpRef.current?.shake();
        setOtp('');
        const msg = err?.error?.message ?? 'Invalid OTP. Please try again.';
        setOtpErrMsg(msg);
        // Clear error shake after animation completes — matches web
        setTimeout(() => setOtpErrMsg(''), 4000);
      } finally {
        setLoading(false);
      }
    },
    [otp, loading, phone, login, show],
  );

  // ── Resend ───────────────────────────────────────────────────────────────────
  const handleResend = useCallback(async () => {
    if (!isFinished) return;
    setOtp('');
    resetTimer();
    try {
      if (flow === 'register') {
        await authApi.register(phone, name);
      } else {
        await authApi.login(phone);
      }
      show({ message: 'New OTP sent!', type: 'success' });
    } catch {
      show({ message: 'Failed to resend. Try again.', type: 'error' });
    }
  }, [isFinished, flow, name, phone, resetTimer, show]);

  // ── Back with confirmation if OTP entered ────────────────────────────────────
  const handleBack = useCallback(() => {
    if (otp.length > 0) {
      Alert.alert('Go back?', 'Your code will be cleared.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Go back', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  }, [otp, navigation]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenHeader title="Verify Number" onBack={handleBack} transparent />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Icon */}
        <Text style={styles.icon}>📱</Text>

        <Text style={styles.heading}>Enter OTP</Text>
        <Text style={styles.sub}>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.phoneHighlight}>+91 {formatPhone(phone)}</Text>
        </Text>

        {/* Dev OTP banner */}
        {__DEV__ && debugOtp ? (
          <TouchableOpacity
            style={styles.devBanner}
            onPress={() => setOtp(String(debugOtp))}
            activeOpacity={0.8}
          >
            <Text style={styles.devBannerText}>
              🛠 Dev OTP: <Text style={styles.devBannerOtp}>{debugOtp}</Text>
              {'  '}(tap to fill)
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* OTP boxes */}
        <OtpInput ref={otpRef} value={otp} onChange={setOtp} style={styles.otpInput} />

        {/* Inline error — matches web's otpErrMsg display */}
        {otpErrMsg ? <Text style={styles.otpErrMsg}>{otpErrMsg}</Text> : null}

        {/* Loading / status */}
        {loading ? <Text style={styles.verifyingText}>Verifying…</Text> : null}

        <Button
          label="Verify"
          onPress={() => handleVerify(otp)}
          disabled={otp.length !== 6}
          loading={loading}
          style={styles.btn}
        />

        {/* Resend */}
        <TouchableOpacity onPress={handleResend} disabled={!isFinished} style={styles.resendWrap}>
          {isFinished ? (
            <Text style={[styles.resendText, styles.resendActive]}>Resend OTP</Text>
          ) : (
            <Text style={styles.resendText}>
              Resend OTP in <Text style={styles.resendBold}>{seconds}s</Text>
            </Text>
          )}
        </TouchableOpacity>

        {/* Change number */}
        <TouchableOpacity onPress={handleBack} style={styles.changeWrap}>
          <Text style={styles.changeText}>Change phone number</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.pageBg },
  scroll: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    fontSize: 56,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  heading: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: FONTS.weight.heavy,
    textAlign: 'center',
    marginBottom: 6,
  },
  sub: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  phoneHighlight: {
    color: COLORS.deepTeal,
    fontWeight: FONTS.weight.bold,
  },
  devBanner: {
    backgroundColor: '#f3f4f6',
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    width: '100%',
  },
  devBannerText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    textAlign: 'center',
  },
  devBannerOtp: {
    color: COLORS.deepTeal,
    fontWeight: FONTS.weight.bold,
    letterSpacing: 2,
  },
  otpInput: {
    marginVertical: SPACING.md,
    width: '100%',
  },
  otpErrMsg: {
    color: '#e05555',
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  verifyingText: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    marginTop: SPACING.xs,
  },
  btn: {
    marginTop: SPACING.sm,
    width: '100%',
  },
  resendWrap: {
    marginTop: SPACING.xl,
    paddingVertical: 4,
  },
  resendText: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.sm,
    textAlign: 'center',
  },
  resendActive: {
    color: COLORS.teal,
    fontWeight: FONTS.weight.semibold,
    textDecorationLine: 'underline',
  },
  resendBold: {
    fontWeight: FONTS.weight.bold,
    color: COLORS.textPrimary,
  },
  changeWrap: {
    marginTop: SPACING.sm,
    paddingVertical: 4,
  },
  changeText: {
    color: COLORS.textMuted,
    fontSize: FONTS.size.xs,
    textAlign: 'center',
  },
});
