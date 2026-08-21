// Cliente HTTP del frontend: envuelve `fetch` con la URL base del backend,
// el token de sesión (Authorization Bearer) y el manejo de sesión expirada
// (401 dispara el evento `auth:expired` que App.jsx escucha para desloguear).
// También expone helpers de sesión (localStorage) y todos los endpoints
// de la API agrupados por área (auth, sync, dashboard, platforms).
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

// Caché en memoria de corta duración para listados que casi no cambian
// entre navegaciones (plataformas, cursos) — evita repetir la misma
// petición cada vez que el usuario cambia de pestaña. Se invalida sola
// al expirar el TTL, y a mano cuando una acción puede haber cambiado los
// datos (crear/editar/borrar plataforma, lanzar una sincronización).
const memoryCache = new Map();
const CACHE_TTL_MS = 60_000;

function cachedRequest(key, fetcher, ttlMs = CACHE_TTL_MS) {
  const now = Date.now();
  const entry = memoryCache.get(key);
  if (entry && entry.expiresAt > now) {
    return entry.promise;
  }
  const promise = fetcher().catch((err) => {
    memoryCache.delete(key);
    throw err;
  });
  memoryCache.set(key, { promise, expiresAt: now + ttlMs });
  return promise;
}

export function invalidateCache(prefix) {
  for (const key of memoryCache.keys()) {
    if (!prefix || key.startsWith(prefix)) memoryCache.delete(key);
  }
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
// Una sola sincronización por plataforma trae TODO (storage + "Cursos y
// Alumnos": matrícula, accesos, calificaciones, foros por alumno). Se puede
// disparar/seguir/cancelar desde Configuración o desde Cursos y Alumnos —
// ambas páginas comparten este mismo estado global.
export const triggerPlatformSync = (id) => request(`/sync/${id}`, { method: 'POST' });
export const cancelSync = () => request('/sync/cancel', { method: 'POST' });
export const getSyncStatus = () => request('/sync/status');

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
export const getCourses = (params = {}) =>
  cachedRequest(`courses:${JSON.stringify(params)}`, () => request(buildPath('/dashboard/courses', params)));
export const getCourseBreakdown = (courseId, params = {}) =>
  request(buildPath(`/dashboard/courses/${courseId}/breakdown`, params), {
    cache: 'no-store',
  });
export const getCourseAccessReport = (courseId, params = {}) =>
  request(buildPath(`/dashboard/courses/${courseId}/access-report`, params), {
    cache: 'no-store',
  });
export const getCourseGradesReport = (courseId, params = {}) =>
  request(buildPath(`/dashboard/courses/${courseId}/grades-report`, params), {
    cache: 'no-store',
  });
export const getTopUsers = (params = {}) =>
  request(buildPath('/dashboard/users/top', params));
export const getInsights = (params = {}) =>
  request(buildPath('/dashboard/insights', params), {
    cache: 'no-store',
  });

/* ─── Platforms ─── */
export const getPlatforms = () => cachedRequest('platforms', () => request('/platforms', { cache: 'no-store' }));
export const addPlatform = (data) =>
  request('/platforms', { method: 'POST', body: JSON.stringify(data) }).then((result) => {
    invalidateCache('platforms');
    return result;
  });
export const updatePlatform = (id, data) =>
  request(`/platforms/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then((result) => {
    invalidateCache('platforms');
    return result;
  });
export const deletePlatform = (id) =>
  request(`/platforms/${id}`, { method: 'DELETE' }).then((result) => {
    invalidateCache('platforms');
    invalidateCache('courses:');
    return result;
  });
export const testPlatform = (id) =>
  request(`/platforms/${id}/test`, { method: 'POST' });
