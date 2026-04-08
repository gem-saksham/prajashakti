/**
 * Manual mock for src/utils/api.js
 * Used by all mobile screen tests via jest.mock('../utils/api').
 *
 * Each authApi method is a jest.fn() so tests can control responses:
 *   authApi.login.mockResolvedValueOnce({ debug_otp: '123456' })
 *   authApi.login.mockRejectedValueOnce({ status: 404, error: { message: 'Not found' } })
 */

export const authApi = {
  register: jest.fn(),
  login: jest.fn(),
  verifyOtp: jest.fn(),
  me: jest.fn(),
  logout: jest.fn(),
};

export const profileApi = {
  getMe: jest.fn(),
  updateProfile: jest.fn(),
  getAvatarUploadUrl: jest.fn(),
  deleteAvatar: jest.fn(),
  getPublicProfile: jest.fn(),
  getActivity: jest.fn(),
};

export const getTokens = jest.fn().mockResolvedValue({ accessToken: null, refreshToken: null });
export const setTokens = jest.fn().mockResolvedValue(undefined);
export const clearTokens = jest.fn().mockResolvedValue(undefined);
export const api = jest.fn();
