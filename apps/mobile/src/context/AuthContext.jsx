import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { authApi, setTokens, clearTokens, getTokens } from '../utils/api';

// ─── State — mirrors web AuthContext exactly ──────────────────────────────────

const initialState = {
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.user,
        token: action.token,
        isLoading: false,
        isAuthenticated: true,
      };
    case 'LOGIN_FAIL':
      return { ...state, user: null, token: null, isLoading: false, isAuthenticated: false };
    case 'LOGOUT':
      return { ...state, user: null, token: null, isLoading: false, isAuthenticated: false };
    case 'UPDATE_PROFILE':
      return { ...state, user: { ...state.user, ...action.updates } };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // ── Bootstrap ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fallback = setTimeout(() => {
      console.warn('[AuthContext] bootstrap timeout');
      dispatch({ type: 'LOGIN_FAIL' });
    }, 5000);

    async function bootstrap() {
      try {
        const { accessToken } = await getTokens();
        if (!accessToken) {
          dispatch({ type: 'LOGIN_FAIL' });
          return;
        }
        const data = await authApi.me();
        dispatch({ type: 'LOGIN_SUCCESS', user: data.user, token: accessToken });
      } catch (err) {
        if (err?.status === 401 || err?.status === 0) {
          await clearTokens();
        }
        dispatch({ type: 'LOGIN_FAIL' });
      } finally {
        clearTimeout(fallback);
      }
    }
    bootstrap();
  }, []);

  // ── login — called after verifyOtp succeeds ───────────────────────────────────
  // Matches web: login(token, user, refreshToken)
  const login = useCallback(async (token, user, refreshToken) => {
    await setTokens({ accessToken: token, refreshToken: refreshToken ?? '' });
    dispatch({ type: 'LOGIN_SUCCESS', user, token });
  }, []);

  // ── logout ────────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      const { refreshToken } = await getTokens();
      await authApi.logout(refreshToken);
    } catch {
      /* best-effort */
    }
    await clearTokens();
    dispatch({ type: 'LOGOUT' });
  }, []);

  // ── updateProfile ─────────────────────────────────────────────────────────────
  const updateProfile = useCallback(async (updates) => {
    const data = await authApi.me(); // re-use me() after PATCH in screen
    dispatch({ type: 'UPDATE_PROFILE', updates: data.user ?? updates });
    return data.user ?? updates;
  }, []);

  const updateUser = useCallback((updates) => {
    dispatch({ type: 'UPDATE_PROFILE', updates });
  }, []);

  const value = {
    user: state.user,
    token: state.token,
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    // keep isLoggedIn as alias so other screens work without changes
    isLoggedIn: state.isAuthenticated,
    login,
    logout,
    updateProfile,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
