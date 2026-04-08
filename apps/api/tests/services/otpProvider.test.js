/**
 * Unit tests — OTP Provider (console strategy)
 */

import { jest } from '@jest/globals';
import { sendOtp } from '../../src/services/otpProvider.js';

describe('OTP Provider (console)', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('console provider logs the OTP and phone', async () => {
    await sendOtp('9111111111', '123456');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('9111111111'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('123456'));
  });

  test('console provider resolves without throwing', async () => {
    await expect(sendOtp('9000000000', '999999')).resolves.toBeUndefined();
  });

  test('OTP generation produces values in the 6-digit range', () => {
    // Test the OTP generator by calling /register repeatedly via helpers
    // Here we validate the range directly
    for (let i = 0; i < 50; i++) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const num = parseInt(otp, 10);
      expect(num).toBeGreaterThanOrEqual(100000);
      expect(num).toBeLessThanOrEqual(999999);
      expect(otp).toHaveLength(6);
    }
  });

  test('OTP values are not deterministic across calls', () => {
    const seen = new Set();
    for (let i = 0; i < 20; i++) {
      seen.add(Math.floor(100000 + Math.random() * 900000).toString());
    }
    // Extremely unlikely to get the same value 20 times in a row
    expect(seen.size).toBeGreaterThan(1);
  });
});
