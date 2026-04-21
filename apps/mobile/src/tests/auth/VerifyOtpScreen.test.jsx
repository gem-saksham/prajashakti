/**
 * VerifyOtpScreen tests — mirrors API auth.test.js /verify-otp cases
 *
 * Covers: correct OTP → login called, wrong OTP → inline error,
 * 429 lockout, resend, back confirmation.
 */
import React from 'react';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react-native';
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

jest.mock('../../utils/api');
jest.mock('../../context/AuthContext');
jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn().mockResolvedValue(''),
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../components/Toast', () => ({
  useToast: () => ({ show: jest.fn() }),
  ToastProvider: ({ children }) => children,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));
// Mock OtpInput so we can easily inject values
jest.mock('../../components/OtpInput', () => {
  const { TextInput } = require('react-native');
  const React = require('react');
  return React.forwardRef(function OtpInput({ value, onChange }, ref) {
    React.useImperativeHandle(ref, () => ({ shake: jest.fn() }));
    return <TextInput testID="otp-input" value={value} onChangeText={onChange} />;
  });
});

import { authApi } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import VerifyOtpScreen from '../../screens/VerifyOtpScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const mockLogin = jest.fn().mockResolvedValue(undefined);

const BASE_PARAMS = { phone: '9876543210', flow: 'login', debugOtp: undefined };

function renderVerify(params = {}) {
  useAuth.mockReturnValue({
    login: mockLogin,
    isAuthenticated: false,
    isLoading: false,
  });
  return render(
    <VerifyOtpScreen navigation={navigation} route={{ params: { ...BASE_PARAMS, ...params } }} />,
  );
}

beforeEach(() => jest.clearAllMocks());

// ── Screen text parity with web ──────────────────────────────────────────────

describe('Screen text matches web', () => {
  test('heading is "Enter OTP"', () => {
    renderVerify();
    expect(screen.getByText('Enter OTP')).toBeTruthy();
  });

  test('shows formatted phone number', () => {
    renderVerify();
    expect(screen.getByText(/98765 43210/)).toBeTruthy();
  });

  test('shows Verify button', () => {
    renderVerify();
    expect(screen.getByText('Verify')).toBeTruthy();
  });

  test('resend countdown text matches web format "Resend OTP in Xs"', () => {
    renderVerify();
    expect(screen.getByText(/Resend OTP in/)).toBeTruthy();
    expect(screen.getByText(/s$/)).toBeTruthy(); // ends with "s" not ":"
  });
});

// ── Dev OTP banner ────────────────────────────────────────────────────────────

describe('Dev OTP banner', () => {
  test('shows tappable debug OTP when provided', () => {
    renderVerify({ debugOtp: '999888' });
    expect(screen.getByText(/999888/)).toBeTruthy();
  });
});

// ── Correct OTP → login called ────────────────────────────────────────────────

describe('Correct OTP verification', () => {
  test('6-digit correct OTP → authApi.verifyOtp called with phone + otp', async () => {
    authApi.verifyOtp.mockResolvedValueOnce({
      accessToken: 'tok_abc',
      refreshToken: 'ref_xyz',
      user: { id: '1', phone: '9876543210', name: 'Test' },
    });

    renderVerify();
    fireEvent.changeText(screen.getByTestId('otp-input'), '123456');

    await waitFor(() => {
      expect(authApi.verifyOtp).toHaveBeenCalledWith('9876543210', '123456');
    });
  });

  test('on success → login(accessToken, user, refreshToken) called', async () => {
    const user = { id: '1', phone: '9876543210', name: 'Test' };
    authApi.verifyOtp.mockResolvedValueOnce({
      accessToken: 'tok_abc',
      refreshToken: 'ref_xyz',
      user,
    });

    renderVerify();
    fireEvent.changeText(screen.getByTestId('otp-input'), '123456');

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('tok_abc', user, 'ref_xyz');
    });
  });

  test('auto-submits when 6th digit entered (no manual Verify press needed)', async () => {
    authApi.verifyOtp.mockResolvedValueOnce({
      accessToken: 'tok',
      refreshToken: 'ref',
      user: { id: '1' },
    });

    renderVerify();
    // Enter all 6 digits at once — mimics auto-submit
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('otp-input'), '654321');
    });

    await waitFor(() => {
      expect(authApi.verifyOtp).toHaveBeenCalledWith('9876543210', '654321');
    });
  });
});

// ── Wrong OTP → inline error ──────────────────────────────────────────────────

describe('Wrong OTP', () => {
  test('wrong OTP → inline error message shown (not just toast)', async () => {
    authApi.verifyOtp.mockRejectedValueOnce({
      status: 400,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid OTP. 2 attempts remaining.' },
    });

    renderVerify();
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('otp-input'), '000000');
    });

    await waitFor(() => {
      expect(screen.getByText(/Invalid OTP/i)).toBeTruthy();
    });
  });

  test('OTP field is cleared after wrong OTP', async () => {
    authApi.verifyOtp.mockRejectedValueOnce({
      status: 400,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid OTP.' },
    });

    renderVerify();
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('otp-input'), '000000');
    });

    await waitFor(() => {
      const input = screen.getByTestId('otp-input');
      expect(input.props.value).toBe('');
    });
  });

  test('3 wrong attempts → 429 error message shown inline', async () => {
    authApi.verifyOtp.mockRejectedValueOnce({
      status: 429,
      error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait 15 minutes.' },
    });

    renderVerify();
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('otp-input'), '000003');
    });

    await waitFor(() => {
      expect(screen.getByText(/15 minutes/i)).toBeTruthy();
    });
  });
});

// ── Resend ────────────────────────────────────────────────────────────────────

describe('Resend OTP', () => {
  test('Resend OTP button is not available during countdown', () => {
    renderVerify();
    // During countdown, "Resend OTP" as a standalone pressable text shouldn't appear
    const resendBtn = screen.queryByText(/^Resend OTP$/);
    // Should show countdown text instead
    expect(screen.getByText(/Resend OTP in/)).toBeTruthy();
    // The standalone "Resend OTP" button should not be present
    expect(resendBtn).toBeNull();
  });
});

// ── Back navigation ───────────────────────────────────────────────────────────

describe('Back navigation', () => {
  test('tapping "Change phone number" with empty OTP goes back without alert', () => {
    renderVerify();
    fireEvent.press(screen.getByText('Change phone number'));
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
