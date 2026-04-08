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
import Input from '../components/Input';
import PhoneInput from '../components/PhoneInput';
import Button from '../components/Button';
import { useToast } from '../components/Toast';
import { authApi } from '../utils/api';
import { validators } from '../utils/validation';
import { COLORS, FONTS, SPACING, RADIUS } from '../theme';

export default function RegisterScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(route.params?.phone ?? '');
  const [loading, setLoading] = useState(false);
  const [nameApiErr, setNameApiErr] = useState('');
  const [phoneApiErr, setPhoneApiErr] = useState('');

  const nameErr = name.length > 0 ? validators.name(name) : null;
  const phoneErr = phone.length > 0 ? validators.phone(phone) : null;
  const canSubmit = !validators.name(name) && !validators.phone(phone);

  const handleSendOtp = useCallback(async () => {
    if (!canSubmit || loading) return;
    Keyboard.dismiss();
    setNameApiErr('');
    setPhoneApiErr('');
    setLoading(true);
    try {
      const res = await authApi.register(phone, name.trim());
      navigation.navigate('VerifyOtp', {
        phone,
        name: name.trim(),
        flow: 'register',
        debugOtp: res?.debug_otp,
      });
    } catch (err) {
      const msg = err?.error?.message ?? 'Something went wrong. Please try again.';
      if (err.status === 409) {
        setPhoneApiErr(msg);
      } else if (err.status === 429) {
        show({ message: 'Too many attempts. Try again later.', type: 'warning' });
      } else {
        setPhoneApiErr(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [canSubmit, loading, name, phone, navigation, show]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenHeader title="Create Account" onBack={() => navigation.goBack()} transparent />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>Create your account</Text>
        <Text style={styles.sub}>Enter your name and phone number</Text>

        <Input
          label="Your name"
          placeholder="Arjun Sharma"
          value={name}
          onChangeText={(t) => {
            setName(t);
            setNameApiErr('');
          }}
          error={nameErr || nameApiErr}
          maxLength={100}
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => Keyboard.dismiss()}
          style={styles.field}
        />

        <PhoneInput
          value={phone}
          onChangeText={(t) => {
            setPhone(t);
            setPhoneApiErr('');
          }}
          error={phoneErr || phoneApiErr}
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

        {/* 409 shortcut */}
        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.switchLink}>
          <Text style={styles.switchText}>
            Already have an account? <Text style={styles.switchHighlight}>Log in</Text>
          </Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          By continuing, you agree to our Terms of Service.{'\n'}No spam. No corporate funding.
          Ever.
        </Text>
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
  legal: {
    color: COLORS.textMuted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: SPACING.lg,
    lineHeight: 16,
  },
});
