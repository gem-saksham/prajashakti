/**
 * Mock AuthContext so screens under test don't need a real provider.
 * Tests that need specific auth state can override via:
 *   useAuth.mockReturnValue({ login: mockLogin, ... })
 */
import { jest } from '@jest/globals';

const mockLogin = jest.fn().mockResolvedValue(undefined);
const mockLogout = jest.fn().mockResolvedValue(undefined);

export const useAuth = jest.fn(() => ({
  user: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,
  isLoggedIn: false,
  login: mockLogin,
  logout: mockLogout,
  updateProfile: jest.fn(),
  updateUser: jest.fn(),
}));

export function AuthProvider({ children }) {
  return children;
}
