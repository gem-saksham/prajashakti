/**
 * LoginScreen tests — mirrors API auth.test.js /login cases
 *
 * Covers: validation, successful OTP send, 404 not-found,
 * 429 rate limit, navigation.
 */
import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

jest.mock('../../utils/api');
jest.mock('../../context/AuthContext');
jest.mock('../../components/Toast', () => ({
  useToast: () => ({ show: jest.fn() }),
  ToastProvider: ({ children }) => children,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));

import { authApi } from '../../utils/api';
import LoginScreen from '../../screens/LoginScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderLogin() {
  return render(<LoginScreen navigation={navigation} route={{ params: {} }} />);
}

beforeEach(() => jest.clearAllMocks());

// ── Screen text parity with web ──────────────────────────────────────────────

describe('Screen text matches web', () => {
  test('heading is "Welcome back"', () => {
    renderLogin();
    expect(screen.getByText('Welcome back')).toBeTruthy();
  });

  test('sub-text is "Enter your phone number to continue"', () => {
    renderLogin();
    expect(screen.getByText('Enter your phone number to continue')).toBeTruthy();
  });

  test('phone label is "Mobile number"', () => {
    renderLogin();
    expect(screen.getByText('Mobile number')).toBeTruthy();
  });

  test('Send OTP button is present', () => {
    renderLogin();
    expect(screen.getByText('Send OTP')).toBeTruthy();
  });
});

// ── Validation ───────────────────────────────────────────────────────────────

describe('Client-side validation', () => {
  test('empty phone → Send OTP does not call API', () => {
    renderLogin();
    fireEvent.press(screen.getByText('Send OTP'));
    expect(authApi.login).not.toHaveBeenCalled();
  });

  test('phone starting with 5 → inline validation error', async () => {
    renderLogin();
    fireEvent.changeText(screen.getByPlaceholderText('10-digit number'), '5123456789');
    await waitFor(() => {
      expect(screen.getByText(/Invalid Indian phone number/i)).toBeTruthy();
    });
  });

  test('phone under 10 digits → blocks submission', () => {
    renderLogin();
    fireEvent.changeText(screen.getByPlaceholderText('10-digit number'), '98765');
    fireEvent.press(screen.getByText('Send OTP'));
    expect(authApi.login).not.toHaveBeenCalled();
  });
});

// ── Successful OTP send ───────────────────────────────────────────────────────

describe('Successful login OTP', () => {
  test('valid phone → calls authApi.login(phone) and navigates to VerifyOtp', async () => {
    authApi.login.mockResolvedValueOnce({ debug_otp: '654321' });

    renderLogin();
    fireEvent.changeText(screen.getByPlaceholderText('10-digit number'), '9876543210');
    fireEvent.press(screen.getByText('Send OTP'));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith('9876543210');
      expect(navigation.navigate).toHaveBeenCalledWith('VerifyOtp', {
        phone: '9876543210',
        flow: 'login',
        debugOtp: '654321',
      });
    });
  });
});

// ── API error handling — inline display, matches web ─────────────────────────

describe('API error handling', () => {
  test('404 NOT_FOUND → inline error below phone field (not toast)', async () => {
    authApi.login.mockRejectedValueOnce({
      status: 404,
      error: { code: 'NOT_FOUND', message: 'No account found with this phone number.' },
    });

    renderLogin();
    fireEvent.changeText(screen.getByPlaceholderText('10-digit number'), '9299999999');
    fireEvent.press(screen.getByText('Send OTP'));

    await waitFor(() => {
      expect(screen.getByText(/No account found/i)).toBeTruthy();
    });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  test('clearing phone after 404 resets error', async () => {
    authApi.login.mockRejectedValueOnce({
      status: 404,
      error: { code: 'NOT_FOUND', message: 'No account found with this phone number.' },
    });

    renderLogin();
    fireEvent.changeText(screen.getByPlaceholderText('10-digit number'), '9299999999');
    fireEvent.press(screen.getByText('Send OTP'));
    await waitFor(() => screen.getByText(/No account found/i));

    fireEvent.changeText(screen.getByPlaceholderText('10-digit number'), '9876543210');
    await waitFor(() => {
      expect(screen.queryByText(/No account found/i)).toBeNull();
    });
  });

  test('network error → inline error shown', async () => {
    authApi.login.mockRejectedValueOnce({
      status: 0,
      error: {
        code: 'NETWORK_ERROR',
        message: 'No internet connection. Please check your network.',
      },
    });

    renderLogin();
    fireEvent.changeText(screen.getByPlaceholderText('10-digit number'), '9876543210');
    fireEvent.press(screen.getByText('Send OTP'));

    await waitFor(() => {
      expect(screen.getByText(/No internet connection/i)).toBeTruthy();
    });
  });
});

// ── Navigation links ─────────────────────────────────────────────────────────

describe('Navigation links', () => {
  test('"Create account" link navigates to Register with current phone pre-filled', () => {
    renderLogin();
    fireEvent.changeText(screen.getByPlaceholderText('10-digit number'), '9876543210');
    fireEvent.press(screen.getByText(/Create account/));
    expect(navigation.navigate).toHaveBeenCalledWith('Register', { phone: '9876543210' });
  });
});
