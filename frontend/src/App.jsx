import { useEffect, useRef, useState } from 'react';
import {
  clearAuthSession,
  getCurrentUser,
  getStoredAuthSession,
  loginUser,
  saveAuthSession,
} from './api';
import LoginPage from './components/LoginPage';
import SyncPanel from './components/SyncPanel';
import Dashboard from './components/Dashboard';
import GlobalPanel from './components/GlobalPanel';
import InsightsPage from './components/InsightsPage';
import ConfigPage from './components/ConfigPage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
const ROLE_LABELS = {
  admin: 'Acceso total',
  limited: 'Sin sincronización',
};

export default function App() {
  const initialSessionRef = useRef(getStoredAuthSession());
  const [session, setSession] = useState(initialSessionRef.current);
  const [authLoading, setAuthLoading] = useState(Boolean(initialSessionRef.current?.token));
  const [authNotice, setAuthNotice] = useState(null);
  const [view, setView] = useState('insights');
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const searchSubmitRef = useRef(null);
  const currentUser = session?.user || null;
  const currentUserRole = currentUser?.role || null;
  const canAccessSync = currentUserRole === 'admin';

  useEffect(() => {
    const existingToken = initialSessionRef.current?.token;

    if (!existingToken) {
      setAuthLoading(false);
      return;
    }

    let cancelled = false;

    getCurrentUser()
      .then((user) => {
        if (cancelled) return;

        const nextSession = {
          token: existingToken,
          user,
        };

        saveAuthSession(nextSession);
        setSession(nextSession);
      })
      .catch(() => {
        if (cancelled) return;
        clearAuthSession();
        setSession(null);
        setAuthNotice('Tu sesión expiró. Inicia sesión nuevamente.');
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleSessionExpired() {
      clearAuthSession();
      setSession(null);
      setSelectedPlatform(null);
      setView('insights');
      setSearchTerm('');
      setAuthNotice('Tu sesión expiró. Inicia sesión nuevamente.');
    }

    window.addEventListener('auth:expired', handleSessionExpired);
    return () => window.removeEventListener('auth:expired', handleSessionExpired);
  }, []);

  useEffect(() => {
    if (!canAccessSync && view === 'sync') {
      setView('global');
    }
  }, [canAccessSync, view]);

  function handleSyncComplete() {
    setRefreshKey((k) => k + 1);
  }

  async function handleLogin(credentials) {
    const nextSession = await loginUser(credentials);

    setSession(nextSession);
    setAuthNotice(null);
    setSelectedPlatform(null);
    setView('insights');
    setSearchTerm('');
  }

  function handleLogout() {
    clearAuthSession();
    setSession(null);
    setAuthNotice(null);
    setSelectedPlatform(null);
    setView('insights');
    setSearchTerm('');
  }

  const resolvedView = view === 'detail' && !selectedPlatform ? 'global' : view;
  const isGlobalView = resolvedView === 'global';

  function openPlatformDetail(platform) {
    setSelectedPlatform(platform);
    setView('detail');
  }


  function handleSearchClick() {
    if (resolvedView !== 'global') {
      setView('global');
    }
    searchSubmitRef.current?.();
  }

  const views = {
    insights: <InsightsPage />,
    global: (
      <GlobalPanel
        onSelectPlatform={openPlatformDetail}
        refreshKey={refreshKey}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchSubmitRef={searchSubmitRef}
      />
    ),
    sync: <SyncPanel onSyncComplete={handleSyncComplete} />,
    detail: (
      <Dashboard
        key={selectedPlatform?.id || 'detail-view'}
        selectedPlatform={selectedPlatform}
        userRole={currentUserRole}
      />
    ),
    config: <ConfigPage />,
  };

  if (authLoading) {
    return (
      <div className="login-screen">
        <div className="login-shell">
          <div className="login-card login-card-loading">
            <span className="spinner login-spinner" />
            <p className="login-loading-text">Validando sesión…</p>
          </div>
        </div>
        <div className="login-powered-by">
          <img src="/login/logo-powered-by.svg" alt="Powered by Awakelab" />
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} notice={authNotice} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="brand-copy">
            <p className="brand-kicker">AWK UI PRODUCTS</p>
            <h1 className="logo">Moodle Admin Instances</h1>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Secciones principales">
          <button
            type="button"
            className={`sidebar-nav-item ${resolvedView === 'insights' ? 'active' : ''}`}
            onClick={() => setView('insights')}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={`sidebar-nav-item ${isGlobalView ? 'active' : ''}`}
            onClick={() => setView('global')}
          >
            Panel global
          </button>
          {canAccessSync && (
            <button
              type="button"
              className={`sidebar-nav-item ${resolvedView === 'sync' ? 'active' : ''}`}
              onClick={() => setView('sync')}
            >
              Sincronización
            </button>
          )}
          <button
            type="button"
            className={`sidebar-nav-item ${resolvedView === 'config' ? 'active' : ''}`}
            onClick={() => setView('config')}
          >
            Configuración
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="session-box">
            <div className="session-copy">
              <span className="session-name">
                {currentUser.displayName || currentUser.username}
              </span>
              <span className="session-role">
                {ROLE_LABELS[currentUser.role] || currentUser.role}
              </span>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </aside>

      <div className="app-content">
        {isGlobalView && (
          <div className="content-topbar">
            <div className="nav-search-wrapper">
              <svg
                className="nav-search-icon"
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <Input
                type="text"
                className="nav-search-input pl-8"
                placeholder="Buscar empresa"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button type="button" onClick={handleSearchClick}>
              Buscar
            </Button>
          </div>
        )}

        <main className="main">
          {views[resolvedView]}
        </main>
      </div>
    </div>
  );
}
