import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth:access_token',
  REFRESH_TOKEN: 'auth:refresh_token',
};

// ─── Token helpers ────────────────────────────────────────────────────────────

export async function getTokens() {
  const [access, refresh] = await AsyncStorage.multiGet([
    STORAGE_KEYS.ACCESS_TOKEN,
    STORAGE_KEYS.REFRESH_TOKEN,
  ]);
  return {
    accessToken: access[1] ?? null,
    refreshToken: refresh[1] ?? null,
  };
}

export async function setTokens({ accessToken, refreshToken }) {
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.ACCESS_TOKEN, accessToken],
    [STORAGE_KEYS.REFRESH_TOKEN, refreshToken],
  ]);
}

export async function clearTokens() {
  await AsyncStorage.multiRemove([STORAGE_KEYS.ACCESS_TOKEN, STORAGE_KEYS.REFRESH_TOKEN]);
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

/**
 * Makes an authenticated API request.
 * Automatically attaches the access token and handles 401 by attempting
 * a token refresh before retrying once.
 *
 * @param {string} path - e.g. "/users/me"
 * @param {RequestInit} options
 * @returns {Promise<any>} Parsed JSON response body
 */
export async function api(path, options = {}) {
  const { accessToken } = await getTokens();

  const headers = {
    'Content-Type': 'application/json',
    ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    ...options.headers,
  };

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw {
      status: 0,
      error: {
        code: 'NETWORK_ERROR',
        message: 'No internet connection. Please check your network.',
      },
    };
  }

  // If unauthorized, try refreshing the token once
  if (response.status === 401) {
    const { refreshToken } = await getTokens();
    if (refreshToken) {
      const refreshed = await attemptTokenRefresh(refreshToken);
      if (refreshed) return api(path, options);
    }
    await clearTokens();
    throw {
      status: 401,
      error: { code: 'UNAUTHORIZED', message: 'Session expired. Please log in again.' },
    };
  }

  const data = await response.json();

  if (!response.ok) {
    // Throw same shape as web: { status, error: { code, message } }
    throw { status: response.status, ...data };
  }

  return data;
}

let _refreshPromise = null; // dedupe concurrent refresh attempts

async function attemptTokenRefresh(refreshToken) {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/users/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;

      const data = await res.json();
      if (data?.accessToken) {
        await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
        // Rotation: store the new refresh token returned by the server
        if (data.refreshToken) {
          await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  })();

  try {
    return await _refreshPromise;
  } finally {
    _refreshPromise = null;
  }
}

// ─── Auth API — signatures match web's authApi exactly ────────────────────────

export const authApi = {
  register: (phone, name) =>
    api('/users/register', { method: 'POST', body: JSON.stringify({ phone, name }) }),
  login: (phone) => api('/users/login', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyOtp: (phone, otp) =>
    api('/users/verify-otp', { method: 'POST', body: JSON.stringify({ phone, otp }) }),
  me: () => api('/users/me'),
  logout: (refreshToken) =>
    api('/users/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
};

// ─── Profile API ──────────────────────────────────────────────────────────────

export const profileApi = {
  getMe: () => api('/users/me'),
  updateProfile: (body) => api('/users/me', { method: 'PATCH', body: JSON.stringify(body) }),
  getAvatarUploadUrl: (fileType) =>
    api('/users/me/avatar-upload-url', { method: 'POST', body: JSON.stringify({ fileType }) }),
  deleteAvatar: () => api('/users/me/avatar', { method: 'DELETE' }),
  getPublicProfile: (id) => api(`/users/${id}`),
  getActivity: (id, page = 1, limit = 20) =>
    api(`/users/${id}/activity?page=${page}&limit=${limit}`),

  // Proxy upload endpoint URL — used by useAvatarUpload hook with FileSystem.uploadAsync
  avatarUploadUrl: `${API_URL}/users/me/avatar`,
};

// ─── Location API ─────────────────────────────────────────────────────────────

export const locationApi = {
  detect: () => api('/location/detect'),
  reverse: (lat, lng) => api(`/location/reverse?lat=${lat}&lng=${lng}`),
  search: (query) => api(`/location/search?q=${encodeURIComponent(query)}`),
};
