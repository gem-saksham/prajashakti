import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import PhoneInput from '../components/PhoneInput';
import Button from '../components/Button';
import { useToast } from '../components/Toast';
import { authApi } from '../utils/api';
import { validators } from '../utils/validation';
import { COLORS, FONTS, SPACING } from '../theme';

export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [phoneApiErr, setPhoneApiErr] = useState('');

  const phoneErr = phone.length > 0 ? validators.phone(phone) : null;
  const canSubmit = !validators.phone(phone);

  const handleSendOtp = useCallback(async () => {
    if (!canSubmit || loading) return;
    Keyboard.dismiss();
    setPhoneApiErr('');
    setLoading(true);
    try {
      const res = await authApi.login(phone);
      navigation.navigate('VerifyOtp', {
        phone,
        flow: 'login',
        debugOtp: res?.debug_otp,
      });
    } catch (err) {
      const msg = err?.error?.message ?? 'Something went wrong. Please try again.';
      if (err.status === 429) {
        show({ message: 'Too many attempts. Try again later.', type: 'warning' });
      } else {
        setPhoneApiErr(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [canSubmit, loading, phone, navigation, show]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenHeader title="Log In" onBack={() => navigation.goBack()} transparent />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.sub}>Enter your phone number to continue</Text>

        <PhoneInput
          value={phone}
          onChangeText={(t) => {
            setPhone(t);
            setPhoneApiErr('');
          }}
          error={phoneErr || phoneApiErr}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSendOtp}
          style={styles.field}
        />

        <Button
          label="Send OTP"
          onPress={handleSendOtp}
          disabled={!canSubmit}
          loading={loading}
          style={styles.btn}
        />

        {/* 404 shortcut */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Register', { phone })}
          style={styles.switchLink}
        >
          <Text style={styles.switchText}>
            New to PrajaShakti? <Text style={styles.switchHighlight}>Create account</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.pageBg },
  scroll: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    gap: 4,
  },
  heading: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: FONTS.weight.heavy,
    marginBottom: 4,
  },
  sub: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.md,
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  field: { marginBottom: SPACING.md },
  btn: { marginTop: SPACING.sm },
  switchLink: {
    alignSelf: 'center',
    marginTop: SPACING.lg,
    paddingVertical: 4,
  },
  switchText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
  },
  switchHighlight: {
    color: COLORS.teal,
    fontWeight: FONTS.weight.semibold,
  },
});
