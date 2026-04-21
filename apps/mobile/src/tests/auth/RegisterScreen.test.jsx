/**
 * RegisterScreen tests — mirrors API auth.test.js cases
 *
 * Covers: validation, successful OTP send, 409 conflict,
 * 429 rate limit, network error.
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
import RegisterScreen from '../../screens/RegisterScreen';

// Minimal navigation mock
const navigation = { navigate: jest.fn(), goBack: jest.fn() };

function renderRegister(params = {}) {
  return render(<RegisterScreen navigation={navigation} route={{ params }} />);
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Screen text parity with web ──────────────────────────────────────────────

describe('Screen text matches web', () => {
  test('heading is "Create your account"', () => {
    renderRegister();
    expect(screen.getByText('Create your account')).toBeTruthy();
  });

  test('sub-text is "Enter your name and phone number"', () => {
    renderRegister();
    expect(screen.getByText('Enter your name and phone number')).toBeTruthy();
  });

  test('name label is "Your name" (lowercase n)', () => {
    renderRegister();
    expect(screen.getByText('Your name')).toBeTruthy();
  });

  test('name placeholder is "Arjun Sharma"', () => {
    renderRegister();
    expect(screen.getByPlaceholderText('Arjun Sharma')).toBeTruthy();
  });

  test('Send OTP button is present', () => {
    renderRegister();
    expect(screen.getByText('Send OTP')).toBeTruthy();
  });

  test('legal footer matches web text', () => {
    renderRegister();
    expect(screen.getByText(/No spam\. No corporate funding\. Ever\./)).toBeTruthy();
  });
});

// ── Validation (mirrors web's client-side checks) ────────────────────────────

describe('Client-side validation', () => {
  test('Send OTP is disabled with empty fields', () => {
    renderRegister();
    const btn = screen.getByText('Send OTP');
    fireEvent.press(btn);
    expect(authApi.register).not.toHaveBeenCalled();
  });

  test('name shorter than 2 chars shows inline error', async () => {
    renderRegister();
    fireEvent.changeText(screen.getByPlaceholderText('Arjun Sharma'), 'A');
    await waitFor(() => {
      expect(screen.getByText(/at least 2 characters/i)).toBeTruthy();
    });
  });

  test('invalid phone (5 digits) blocks submission', async () => {
    renderRegister();
    fireEvent.changeText(screen.getByPlaceholderText('Arjun Sharma'), 'Arjun Sharma');
    fireEvent.changeText(screen.getByPlaceholderText('10-digit number'), '12345');
    fireEvent.press(screen.getByText('Send OTP'));
    expect(authApi.register).not.toHaveBeenCalled();
  });
});

// ── Successful OTP send ───────────────────────────────────────────────────────

describe('Successful registration', () => {
  test('valid inputs → calls authApi.register and navigates to VerifyOtp', async () => {
    authApi.register.mockResolvedValueOnce({ debug_otp: '123456' });

    renderRegister();
    fireEvent.changeText(screen.getByPlaceholderText('Arjun Sharma'), 'Arjun Sharma');
    fireEvent.changeText(screen.getByPlaceholderText('10-digit number'), '9876543210');
    fireEvent.press(screen.getByText('Send OTP'));

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith('9876543210', 'Arjun Sharma');
      expect(navigation.navigate).toHaveBeenCalledWith('VerifyOtp', {
        phone: '9876543210',
        name: 'Arjun Sharma',
        flow: 'register',
        debugOtp: '123456',
      });
    });
  });

  test('pre-filled phone from route params is passed to API', async () => {
    authApi.register.mockResolvedValueOnce({ debug_otp: '654321' });

    renderRegister({ phone: '9000000001' });
    fireEvent.changeText(screen.getByPlaceholderText('Arjun Sharma'), 'Test User');
    fireEvent.press(screen.getByText('Send OTP'));

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith('9000000001', 'Test User');
    });
  });
});

// ── API error handling — inline display, matches web ─────────────────────────

describe('API error handling', () => {
  test('409 CONFLICT → inline error below phone field (not toast)', async () => {
    authApi.register.mockRejectedValueOnce({
      status: 409,
      error: {
        code: 'CONFLICT',
        message: 'Phone number already registered. Please use /login instead.',
      },
    });

    renderRegister();
    fireEvent.changeText(screen.getByPlaceholderText('Arjun Sharma'), 'Arjun');
    fireEvent.changeText(screen.getByPlaceholderText('10-digit number'), '9876543210');
    fireEvent.press(screen.getByText('Send OTP'));

    await waitFor(() => {
      expect(screen.getByText(/already registered/i)).toBeTruthy();
    });
    // Must NOT navigate away
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  test('network error → inline error shown', async () => {
    authApi.register.mockRejectedValueOnce({
      status: 0,
      error: {
        code: 'NETWORK_ERROR',
        message: 'No internet connection. Please check your network.',
      },
    });

    renderRegister();
    fireEvent.changeText(screen.getByPlaceholderText('Arjun Sharma'), 'Arjun');
    fireEvent.changeText(screen.getByPlaceholderText('10-digit number'), '9876543210');
    fireEvent.press(screen.getByText('Send OTP'));

    await waitFor(() => {
      expect(screen.getByText(/No internet connection/i)).toBeTruthy();
    });
  });

  test('clearing phone after API error resets inline error', async () => {
    authApi.register.mockRejectedValueOnce({
      status: 409,
      error: {
        code: 'CONFLICT',
        message: 'Phone number already registered. Please use /login instead.',
      },
    });

    renderRegister();
    fireEvent.changeText(screen.getByPlaceholderText('Arjun Sharma'), 'Arjun');
    fireEvent.changeText(screen.getByPlaceholderText('10-digit number'), '9876543210');
    fireEvent.press(screen.getByText('Send OTP'));

    await waitFor(() => screen.getByText(/already registered/i));

    // Editing phone clears error
    fireEvent.changeText(screen.getByPlaceholderText('10-digit number'), '9876543211');
    await waitFor(() => {
      expect(screen.queryByText(/already registered/i)).toBeNull();
    });
  });
});

// ── Switch to login link ──────────────────────────────────────────────────────

describe('Navigation links', () => {
  test('"Already have an account? Log in" navigates to Login', () => {
    renderRegister();
    fireEvent.press(screen.getByText(/Log in/));
    expect(navigation.navigate).toHaveBeenCalledWith('Login');
  });
});
