import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { authApi } from '../utils/api.js';

// ─── State shape ──────────────────────────────────────────────────────────────

const initialState = {
  user: null,
  token: null,
  isLoading: true, // true while we check stored token on mount
  isAuthenticated: false,
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

function authReducer(state, action) {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, isLoading: true };

    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.user,
        token: action.token,
        isLoading: false,
        isAuthenticated: true,
      };

    case 'LOGIN_FAIL':
      return {
        ...state,
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
      };

    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
      };

    case 'UPDATE_PROFILE':
      return {
        ...state,
        user: { ...state.user, ...action.updates },
      };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // ── Bootstrap: validate stored token on mount ────────────────────────────
  useEffect(() => {
    async function bootstrap() {
      const storedToken = localStorage.getItem('prajashakti_token');

      if (!storedToken) {
        dispatch({ type: 'LOGIN_FAIL' });
        return;
      }

      try {
        const data = await authApi.me();
        dispatch({ type: 'LOGIN_SUCCESS', user: data.user, token: storedToken });
      } catch (err) {
        // 401 handled in api.js (redirects), but catch anything else
        if (err?.status === 401 || err?.status === 0) {
          localStorage.removeItem('prajashakti_token');
          localStorage.removeItem('prajashakti_refresh_token');
        }
        dispatch({ type: 'LOGIN_FAIL' });
      }
    }

    bootstrap();
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const login = useCallback((token, user, refreshToken) => {
    localStorage.setItem('prajashakti_token', token);
    if (refreshToken) localStorage.setItem('prajashakti_refresh_token', refreshToken);
    dispatch({ type: 'LOGIN_SUCCESS', user, token });
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('prajashakti_refresh_token');
    try {
      await authApi.logout(refreshToken);
    } catch {
      // Best-effort — clear local state regardless
    }
    localStorage.removeItem('prajashakti_token');
    localStorage.removeItem('prajashakti_refresh_token');
    dispatch({ type: 'LOGOUT' });
  }, []);

  const updateProfile = useCallback(async (updates) => {
    const data = await authApi.updateProfile(updates);
    dispatch({ type: 'UPDATE_PROFILE', updates: data.user });
    return data.user;
  }, []);

  // Sync local context without re-fetching (e.g. after deleteAvatar)
  const updateUser = useCallback((updates) => {
    dispatch({ type: 'UPDATE_PROFILE', updates });
  }, []);

  const value = {
    user: state.user,
    token: state.token,
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    login,
    logout,
    updateProfile,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
