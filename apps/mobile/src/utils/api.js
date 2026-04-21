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

// ─── Query-string helper ──────────────────────────────────────────────────────

function qs(params) {
  const filtered = Object.entries(params || {}).filter(([, v]) => v != null && v !== '');
  if (filtered.length === 0) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of filtered) sp.set(k, String(v));
  return `?${sp.toString()}`;
}

// ─── URL-safe base64 (RN has no `btoa`) ───────────────────────────────────────

function b64UrlEncode(input) {
  const str = typeof input === 'string' ? input : String(input);
  // global.Buffer exists in recent RN runtimes; fallback to manual encoder
  let b64;
  if (typeof global !== 'undefined' && global.Buffer) {
    b64 = global.Buffer.from(str, 'utf8').toString('base64');
  } else {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let out = '';
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    for (let i = 0; i < bytes.length; i += 3) {
      const b1 = bytes[i];
      const b2 = bytes[i + 1];
      const b3 = bytes[i + 2];
      out += chars[b1 >> 2];
      out += chars[((b1 & 0x03) << 4) | ((b2 ?? 0) >> 4)];
      out += b2 === undefined ? '=' : chars[((b2 & 0x0f) << 2) | ((b3 ?? 0) >> 6)];
      out += b3 === undefined ? '=' : chars[b3 & 0x3f];
    }
    b64 = out;
  }
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ─── Issue API ────────────────────────────────────────────────────────────────

export const issueApi = {
  create: (data) => api('/issues', { method: 'POST', body: JSON.stringify(data) }),
  list: (params = {}) => api(`/issues${qs(params)}`),
  get: (id) => api(`/issues/${id}`),
  getRelated: (id, limit = 3) => api(`/issues/${id}/related?limit=${limit}`),
  update: (id, data) => api(`/issues/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id) => api(`/issues/${id}`, { method: 'DELETE' }),
  getFeed: (params = {}) => api(`/feed${qs(params)}`),
  suggestTags: (data) =>
    api('/issues/suggest-tags', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Photo API ────────────────────────────────────────────────────────────────

export const photoApi = {
  requestUploadUrl: (issueId, fileType) =>
    api(`/issues/${issueId}/photos/upload-url`, {
      method: 'POST',
      body: JSON.stringify({ file_type: fileType }),
    }),
  confirm: (issueId, fileKey) =>
    api(`/issues/${issueId}/photos/confirm`, {
      method: 'POST',
      body: JSON.stringify({ file_key: fileKey }),
    }),
  delete: (issueId, fileKey) =>
    api(`/issues/${issueId}/photos/${b64UrlEncode(fileKey)}`, { method: 'DELETE' }),
};

// ─── Officials API ────────────────────────────────────────────────────────────

export const officialApi = {
  search: (q, jurisdiction) => {
    const params = new URLSearchParams({ q });
    if (jurisdiction) params.set('jurisdiction', jurisdiction);
    return api(`/officials?${params.toString()}`);
  },
};

// ─── Support API ──────────────────────────────────────────────────────────────

export const supportApi = {
  support: (issueId) => api(`/issues/${issueId}/support`, { method: 'POST' }),
  unsupport: (issueId) => api(`/issues/${issueId}/support`, { method: 'DELETE' }),
  getStats: (issueId) => api(`/issues/${issueId}/support-stats`),
  getSupporters: (issueId, page = 1, limit = 20) =>
    api(`/issues/${issueId}/supporters?page=${page}&limit=${limit}`),
};

// ─── AI API ───────────────────────────────────────────────────────────────────

export const aiApi = {
  generateDraft: (data) => api('/ai/draft', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Stories API ──────────────────────────────────────────────────────────────

export const storyApi = {
  list: (issueId, page = 1, limit = 20) =>
    api(`/issues/${issueId}/stories?page=${page}&limit=${limit}`),
  create: (issueId, data) =>
    api(`/issues/${issueId}/stories`, { method: 'POST', body: JSON.stringify(data) }),
  toggleHelpful: (issueId, storyId) =>
    api(`/issues/${issueId}/stories/${storyId}/helpful`, { method: 'POST' }),
  remove: (issueId, storyId) => api(`/issues/${issueId}/stories/${storyId}`, { method: 'DELETE' }),
};

// ─── Search API ───────────────────────────────────────────────────────────────

export const searchApi = {
  suggest: (q, limit = 5) => api(`/search/suggest?q=${encodeURIComponent(q)}&limit=${limit}`),
  log: (data) => api('/search/log', { method: 'POST', body: JSON.stringify(data) }),
  click: (data) => api('/search/click', { method: 'POST', body: JSON.stringify(data) }),
};

/**
 * Upload a file to S3 using a pre-signed URL (React Native).
 * Pass a `{ uri, type, name }` object (from expo-image-picker / DocumentPicker)
 * OR a Blob. Uses XHR so we can report progress.
 */
export function uploadToS3(uploadUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type ?? 'application/octet-stream');
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () =>
      xhr.status < 300 ? resolve() : reject(new Error(`S3 upload failed: ${xhr.status}`));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    // RN: pass the whole file object — fetch/XHR understands { uri, type, name }
    xhr.send(file);
  });
}
