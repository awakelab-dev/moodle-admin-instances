const BASE = `${import.meta.env.VITE_API_URL || ''}/api`;
const AUTH_STORAGE_KEY = 'moodle-admin-session';

function buildPath(path, params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

async function request(path, options = {}) {
  const session = getStoredAuthSession();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(body.error || `HTTP ${res.status}`);

    error.status = res.status;
    error.body = body;

    if (res.status === 401 && session?.token && path !== '/auth/login') {
      clearAuthSession();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth:expired'));
      }
    }

    throw error;
  }

  if (res.status === 204) return null;

  return res.json();
}

export function getStoredAuthSession() {
  if (typeof window === 'undefined') return null;

  try {
    const rawSession = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return rawSession ? JSON.parse(rawSession) : null;
  } catch {
    return null;
  }
}

export function saveAuthSession(session) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

/* ─── Auth ─── */
export async function loginUser(credentials) {
  const session = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });

  saveAuthSession(session);
  return session;
}

export const getCurrentUser = () =>
  request('/auth/me', {
    cache: 'no-store',
  });

/* ─── Sync ─── */
export const triggerSync = () => request('/sync', { method: 'POST' });
export const triggerPlatformSync = (id) => request(`/sync/${id}`, { method: 'POST' });
export const getSyncStatus = () => request('/sync/status');
export const getLastSync = () => request('/sync/last');

/* ─── Dashboard ─── */
export const getPlatformStorageSummary = (params = {}) =>
  request(buildPath('/dashboard/platforms/summary', params), {
    cache: 'no-store',
  });
export const getPlatformHistory = (params = {}) =>
  request(buildPath('/dashboard/platforms/history', params), {
    cache: 'no-store',
  });
export const getGlobalStorageHistory = () =>
  request('/dashboard/platforms/history/global-storage', {
    cache: 'no-store',
  });
export const getCourses = (params = {}) => request(buildPath('/dashboard/courses', params));
export const getCourseBreakdown = (courseId, params = {}) =>
  request(buildPath(`/dashboard/courses/${courseId}/breakdown`, params), {
    cache: 'no-store',
  });
export const getTopUsers = (params = {}) =>
  request(buildPath('/dashboard/users/top', params));
export const getInsights = (params = {}) =>
  request(buildPath('/dashboard/insights', params), {
    cache: 'no-store',
  });

/* ─── Platforms ─── */
export const getPlatforms = () => request('/platforms', { cache: 'no-store' });
export const addPlatform = (data) =>
  request('/platforms', { method: 'POST', body: JSON.stringify(data) });
export const updatePlatform = (id, data) =>
  request(`/platforms/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deletePlatform = (id) =>
  request(`/platforms/${id}`, { method: 'DELETE' });
export const testPlatform = (id) =>
  request(`/platforms/${id}/test`, { method: 'POST' });
