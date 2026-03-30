const API_BASE = '/api';

export async function api(endpoint, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('prajashakti_token') : null;

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || 'API request failed');
  }

  return data;
}

export const auth = {
  register: (phone, name) => api('/users/register', { method: 'POST', body: JSON.stringify({ phone, name }) }),
  verifyOtp: (phone, otp) => api('/users/verify-otp', { method: 'POST', body: JSON.stringify({ phone, otp }) }),
  login: (phone) => api('/users/login', { method: 'POST', body: JSON.stringify({ phone }) }),
  me: () => api('/users/me'),
  update: (data) => api('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
};
