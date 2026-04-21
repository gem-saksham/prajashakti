const API_BASE = '/api/v1';

// ── Token refresh (with deduplication) ───────────────────────────────────────

let refreshPromise = null; // dedupe concurrent refresh attempts

async function attemptRefresh() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem('prajashakti_refresh');
    if (!refreshToken) throw new Error('No refresh token');

    const response = await fetch(`${API_BASE}/users/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) throw new Error('Refresh failed');

    const data = await response.json();
    const { accessToken, refreshToken: newRefresh } = data;

    localStorage.setItem('prajashakti_token', accessToken);
    // Rotation: store the NEW refresh token returned by the server
    if (newRefresh) localStorage.setItem('prajashakti_refresh', newRefresh);

    return accessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

/**
 * Core fetch wrapper.
 * - Auto-attaches Authorization header from localStorage.
 * - On 401: attempts one silent token refresh, retries the original request.
 *   Only redirects to login if the refresh itself fails.
 * - On non-OK: throws { status, error: { code, message } }.
 */
export async function api(endpoint, options = {}, _isRetry = false) {
  const token = localStorage.getItem('prajashakti_token');

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, config);
  } catch {
    throw {
      status: 0,
      error: {
        code: 'NETWORK_ERROR',
        message: 'No internet connection. Please check your network.',
      },
    };
  }

  if (response.status === 401 && !_isRetry) {
    // Attempt silent refresh once
    try {
      await attemptRefresh();
      // Retry original request with the new token
      return api(endpoint, options, true);
    } catch {
      // Refresh failed — clear everything and redirect to login
      localStorage.removeItem('prajashakti_token');
      localStorage.removeItem('prajashakti_refresh');
      localStorage.removeItem('prajashakti_user');
      window.location.href = '/';
      throw {
        status: 401,
        error: { code: 'UNAUTHORIZED', message: 'Session expired. Please login again.' },
      };
    }
  }

  const data = await response.json();
  if (!response.ok) {
    throw { status: response.status, ...data };
  }
  return data;
}

export const authApi = {
  register: (phone, name) =>
    api('/users/register', { method: 'POST', body: JSON.stringify({ phone, name }) }),
  login: (phone) => api('/users/login', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyOtp: (phone, otp) =>
    api('/users/verify-otp', { method: 'POST', body: JSON.stringify({ phone, otp }) }),
  me: () => api('/users/me'),
  updateProfile: (data) => api('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
  logout: (refreshToken) =>
    api('/users/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
};

export const profileApi = {
  getPublicProfile: (userId) => api(`/users/${userId}`),
  getActivity: (userId, page = 1, limit = 20) =>
    api(`/users/${userId}/activity?page=${page}&limit=${limit}`),
  getAvatarUploadUrl: (fileType) =>
    api('/users/me/avatar-upload-url', { method: 'POST', body: JSON.stringify({ fileType }) }),
  deleteAvatar: () => api('/users/me/avatar', { method: 'DELETE' }),
};

export const locationApi = {
  detect: () => api('/location/detect'),
  reverse: (lat, lng) => api(`/location/reverse?lat=${lat}&lng=${lng}`),
  search: (q) => api(`/location/search?q=${encodeURIComponent(q)}`),
};

export const issueApi = {
  create: (data) => api('/issues', { method: 'POST', body: JSON.stringify(data) }),
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null)),
    ).toString();
    return api(`/issues${qs ? '?' + qs : ''}`);
  },
  get: (id) => api(`/issues/${id}`),
  getRelated: (id, limit = 3) => api(`/issues/${id}/related?limit=${limit}`),
  update: (id, data) => api(`/issues/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id) => api(`/issues/${id}`, { method: 'DELETE' }),
  getFeed: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null)),
    ).toString();
    return api(`/feed${qs ? '?' + qs : ''}`);
  },
  suggestTags: (data) =>
    api('/issues/suggest-tags', { method: 'POST', body: JSON.stringify(data) }),
};

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
  delete: (issueId, fileKey) => {
    const encoded = btoa(fileKey).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return api(`/issues/${issueId}/photos/${encoded}`, { method: 'DELETE' });
  },
};

export const officialApi = {
  search: (q, jurisdiction) => {
    const params = new URLSearchParams({ q });
    if (jurisdiction) params.set('jurisdiction', jurisdiction);
    return api(`/officials?${params}`);
  },
};

export const supportApi = {
  support: (issueId) => api(`/issues/${issueId}/support`, { method: 'POST' }),
  unsupport: (issueId) => api(`/issues/${issueId}/support`, { method: 'DELETE' }),
  getStats: (issueId) => api(`/issues/${issueId}/support-stats`),
  getSupporters: (issueId, page = 1, limit = 20) =>
    api(`/issues/${issueId}/supporters?page=${page}&limit=${limit}`),
};

export const aiApi = {
  generateDraft: (data) => api('/ai/draft', { method: 'POST', body: JSON.stringify(data) }),
};

export const storyApi = {
  list: (issueId, page = 1, limit = 20) =>
    api(`/issues/${issueId}/stories?page=${page}&limit=${limit}`),
  create: (issueId, data) =>
    api(`/issues/${issueId}/stories`, { method: 'POST', body: JSON.stringify(data) }),
  toggleHelpful: (issueId, storyId) =>
    api(`/issues/${issueId}/stories/${storyId}/helpful`, { method: 'POST' }),
  remove: (issueId, storyId) => api(`/issues/${issueId}/stories/${storyId}`, { method: 'DELETE' }),
};

export const searchApi = {
  suggest: (q, limit = 5) => api(`/search/suggest?q=${encodeURIComponent(q)}&limit=${limit}`),
  log: (data) => api('/search/log', { method: 'POST', body: JSON.stringify(data) }),
  click: (data) => api('/search/click', { method: 'POST', body: JSON.stringify(data) }),
};

/**
 * Upload a file directly to S3 using a pre-signed URL.
 * Uses XMLHttpRequest so we can track progress.
 */
export function uploadToS3(uploadUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () =>
      xhr.status < 300 ? resolve() : reject(new Error(`S3 upload failed: ${xhr.status}`));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
}
