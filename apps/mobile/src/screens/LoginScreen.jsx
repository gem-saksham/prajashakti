import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';

const COLORS = {
  deepTeal: '#0D4F4F',
  teal: '#14897A',
  crimson: '#DC143C',
  bg: '#F4F5F0',
  white: '#FFFFFF',
  border: 'rgba(0,0,0,0.1)',
  textPrimary: '#1a1a1a',
  textSecondary: '#555',
  textMuted: '#888',
};

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'

  const handleSendOtp = () => {
    // TODO (Day 12): Call API /users/login or /users/register
    if (phone.length === 10) setStep('otp');
  };

  const handleVerifyOtp = () => {
    // TODO (Day 12): Call API /users/verify-otp, store token
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>प्रजाशक्ति</Text>
        <Text style={styles.tagline}>POWER OF THE CITIZENS</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>
          {step === 'phone' ? 'Welcome to PrajaShakti' : 'Enter OTP'}
        </Text>
        <Text style={styles.subtitle}>
          {step === 'phone'
            ? 'Enter your phone number to get started'
            : `We sent a code to +91 ${phone}`}
        </Text>

        {step === 'phone' ? (
          <>
            <View style={styles.phoneRow}>
              <Text style={styles.prefix}>+91</Text>
              <TextInput
                style={styles.input}
                placeholder="Phone number"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
              />
            </View>
            <TouchableOpacity
              style={[styles.button, phone.length !== 10 && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={phone.length !== 10}
            >
              <Text style={styles.buttonText}>Send OTP</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={[styles.input, { textAlign: 'center', letterSpacing: 8, fontSize: 24 }]}
              placeholder="000000"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
            />
            <TouchableOpacity
              style={[styles.button, otp.length !== 6 && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={otp.length !== 6}
            >
              <Text style={styles.buttonText}>Verify & Login</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep('phone')}>
              <Text style={styles.link}>Change phone number</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Text style={styles.footer}>
        By continuing, you agree to PrajaShakti's Terms of Service
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', padding: 20 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 40, fontWeight: '800', color: COLORS.deepTeal },
  tagline: { fontSize: 11, color: COLORS.teal, letterSpacing: 3, fontWeight: '600', marginTop: 4 },
  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 24, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 20, lineHeight: 20 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  prefix: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, marginRight: 8, padding: 14, backgroundColor: COLORS.bg, borderRadius: 10 },
  input: { flex: 1, padding: 14, fontSize: 16, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, color: COLORS.textPrimary },
  button: { backgroundColor: COLORS.deepTeal, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  link: { color: COLORS.teal, textAlign: 'center', marginTop: 16, fontSize: 14, fontWeight: '600' },
  footer: { textAlign: 'center', fontSize: 12, color: COLORS.textMuted, marginTop: 16 },
});
