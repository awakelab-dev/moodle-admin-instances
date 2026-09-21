// Componente raíz de la app: maneja la sesión de autenticación (login,
// restauración de sesión guardada y expiración), el enrutado manual entre
// vistas (sin react-router, solo estado local `view`) y el sidebar con sus
// tres categorías colapsables.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ChevronDown, LayoutDashboard, HardDrive, Settings, GraduationCap, Users, Sun, Moon, Bell } from 'lucide-react';
import {
  clearAuthSession,
  getCurrentUser,
  getStoredAuthSession,
  invalidateCache,
  loginUser,
  saveAuthSession,
} from './api';
import LoginPage from './components/LoginPage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Cada pantalla pesada (gráficos, tablas) se carga solo cuando se navega a
// ella, en vez de ir toda en el bundle inicial.
const Dashboard = lazy(() => import('./components/Dashboard'));
const GlobalPanel = lazy(() => import('./components/GlobalPanel'));
const InsightsPage = lazy(() => import('./components/InsightsPage'));
const CoursesStudentsPage = lazy(() => import('./components/CoursesStudentsPage'));
const NotificationsPage = lazy(() => import('./components/NotificationsPage'));
const ConfigPage = lazy(() => import('./components/ConfigPage'));
const UsersPage = lazy(() => import('./components/UsersPage'));
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
  const [searchTerm, setSearchTerm] = useState('');
  // El sidebar se organiza en tres categorías (Storage, Moodle Insights,
  // Configuración), cada una con su propio ítem o grupo de ítems debajo.
  // Cada categoría se puede colapsar/expandir de forma independiente, por
  // eso hay un booleano de "expandido" separado por categoría en vez de un
  // único estado compartido: así el usuario puede cerrar, por ejemplo,
  // "Configuración" sin que eso afecte a "Storage" o "Moodle Insights".
  const [storageNavExpanded, setStorageNavExpanded] = useState(true);
  const [insightsNavExpanded, setInsightsNavExpanded] = useState(true);
  const [configNavExpanded, setConfigNavExpanded] = useState(true);
  // Tema claro de toda la app (Dashboard, Cursos y Alumnos, Storage,
  // Configuración, Usuarios). Preferencia por navegador (no por
  // usuario/servidor): es una comodidad visual personal, no un dato que
  // haga falta compartir ni recuperar en otro dispositivo.
  const [lightTheme, setLightTheme] = useState(() => {
    try {
      return localStorage.getItem('moodle-insights-theme') === 'light';
    } catch {
      return false;
    }
  });

  const searchSubmitRef = useRef(null);
  const currentUser = session?.user || null;
  const currentUserRole = currentUser?.role || null;

  // La clase también se refleja en <html>, además de en `.app-shell` (ver
  // JSX más abajo): los desplegables de <Select> (Radix Portal) se
  // renderizan directamente en <body>, fuera del árbol de `.app-shell`, así
  // que sin esto se quedaban siempre en tema oscuro pese a activar el claro.
  // Solo se aplica con sesión iniciada: el login mantiene siempre su fondo y
  // logo de marca oscuros (el logo usa texto casi blanco, pensado para
  // fondo oscuro — se leería mal sobre una tarjeta de login clara).
  useEffect(() => {
    document.documentElement.classList.toggle('theme-light', lightTheme && Boolean(currentUser));
  }, [lightTheme, currentUser]);

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

  async function handleLogin(credentials) {
    const nextSession = await loginUser(credentials);

    // Por si la sesión anterior expiró sola (sin pasar por handleLogout) y
    // se inicia sesión con un usuario distinto en la misma pestaña: fuerza
    // a pedir todo de nuevo en vez de arrastrar caché del usuario anterior.
    invalidateCache();
    setSession(nextSession);
    setAuthNotice(null);
    setSelectedPlatform(null);
    setView('insights');
    setSearchTerm('');
  }

  function handleLogout() {
    clearAuthSession();
    // getPlatforms() (y cualquier otro endpoint cacheado) guarda su
    // respuesta en memoria con una clave global, no por usuario — sin
    // esto, si se inicia sesión con otro usuario en la misma pestaña sin
    // recargar la página, podría quedar servida la lista de plataformas
    // (u otros datos) del usuario anterior hasta que expire el caché.
    invalidateCache();
    setSession(null);
    setAuthNotice(null);
    setSelectedPlatform(null);
    setView('insights');
    setSearchTerm('');
  }

  const isAdmin = currentUserRole === 'admin';
  // Storage/Configuración/Usuarios son exclusivos de superadmin — si un
  // usuario "limited" tuviera alguna de estas vistas en su estado (p. ej.
  // quedó guardada de una sesión anterior con otro rol), se le manda al
  // Dashboard en vez de dejarle ver una pantalla a la que no debería llegar.
  const ADMIN_ONLY_VIEWS = new Set(['global', 'detail', 'config', 'users', 'notifications']);
  const resolvedView = !isAdmin && ADMIN_ONLY_VIEWS.has(view)
    ? 'insights'
    : view === 'detail' && !selectedPlatform ? 'global' : view;
  const isGlobalView = resolvedView === 'global';

  function toggleTheme() {
    setLightTheme((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('moodle-insights-theme', next ? 'light' : 'dark');
      } catch {
        // localStorage no disponible: el toggle sigue funcionando en esta sesión, solo no se recuerda la próxima vez
      }
      return next;
    });
  }

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
    insights: <InsightsPage lightTheme={lightTheme} />,
    global: (
      <GlobalPanel
        onSelectPlatform={openPlatformDetail}
        onNavigateToConfig={() => setView('config')}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchSubmitRef={searchSubmitRef}
        lightTheme={lightTheme}
      />
    ),
    detail: (
      <Dashboard
        key={selectedPlatform?.id || 'detail-view'}
        selectedPlatform={selectedPlatform}
        lightTheme={lightTheme}
        userRole={currentUserRole}
        onBackToStorage={() => setView('global')}
      />
    ),
    'courses-students': <CoursesStudentsPage />,
    notifications: <NotificationsPage />,
    config: <ConfigPage />,
    users: <UsersPage />,
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
    <div className={`app-shell ${lightTheme ? 'theme-light' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="brand-copy">
            <p className="brand-kicker">AWK PLATFORMS MANAGER</p>
            <h1 className="logo">AWK Platforms Manager</h1>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Secciones principales">
          {isAdmin && (
            <>
              <button
                type="button"
                className="sidebar-nav-category"
                onClick={() => setStorageNavExpanded((prev) => !prev)}
                aria-expanded={storageNavExpanded}
              >
                <span>Storage</span>
                <ChevronDown
                  size={16}
                  className={`sidebar-nav-chevron ${storageNavExpanded ? '' : 'is-collapsed'}`}
                />
              </button>

              {storageNavExpanded && (
                <div className="sidebar-nav-group">
                  <button
                    type="button"
                    className={`sidebar-nav-item ${isGlobalView ? 'active' : ''}`}
                    onClick={() => setView('global')}
                  >
                    <HardDrive size={16} />
                    Administración
                  </button>
                </div>
              )}
            </>
          )}

          <button
            type="button"
            className="sidebar-nav-category"
            onClick={() => setInsightsNavExpanded((prev) => !prev)}
            aria-expanded={insightsNavExpanded}
          >
            <span>Moodle Insights</span>
            <ChevronDown
              size={16}
              className={`sidebar-nav-chevron ${insightsNavExpanded ? '' : 'is-collapsed'}`}
            />
          </button>

          {insightsNavExpanded && (
            <div className="sidebar-nav-group">
              <button
                type="button"
                className={`sidebar-nav-item ${resolvedView === 'insights' ? 'active' : ''}`}
                onClick={() => setView('insights')}
              >
                <LayoutDashboard size={16} />
                Dashboard
              </button>
              <button
                type="button"
                className={`sidebar-nav-item ${resolvedView === 'courses-students' ? 'active' : ''}`}
                onClick={() => setView('courses-students')}
              >
                <GraduationCap size={16} />
                Cursos y Alumnos
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className={`sidebar-nav-item ${resolvedView === 'notifications' ? 'active' : ''}`}
                  onClick={() => setView('notifications')}
                >
                  <Bell size={16} />
                  Gestión de Notificaciones
                </button>
              )}
            </div>
          )}

          {isAdmin && (
            <>
              <button
                type="button"
                className="sidebar-nav-category"
                onClick={() => setConfigNavExpanded((prev) => !prev)}
                aria-expanded={configNavExpanded}
              >
                <span>Configuración</span>
                <ChevronDown
                  size={16}
                  className={`sidebar-nav-chevron ${configNavExpanded ? '' : 'is-collapsed'}`}
                />
              </button>

              {configNavExpanded && (
                <div className="sidebar-nav-group">
                  <button
                    type="button"
                    className={`sidebar-nav-item ${resolvedView === 'config' ? 'active' : ''}`}
                    onClick={() => setView('config')}
                  >
                    <Settings size={16} />
                    Plataformas
                  </button>
                  <button
                    type="button"
                    className={`sidebar-nav-item ${resolvedView === 'users' ? 'active' : ''}`}
                    onClick={() => setView('users')}
                  >
                    <Users size={16} />
                    Usuarios
                  </button>
                </div>
              )}
            </>
          )}
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
        <div className="content-topbar">
          {isGlobalView && (
            <>
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
            </>
          )}
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-pressed={lightTheme}
            title={lightTheme ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'}
          >
            {lightTheme ? <Moon size={15} /> : <Sun size={15} />}
            {lightTheme ? 'Tema oscuro' : 'Tema claro'}
          </button>
        </div>

        <main className="main">
          <Suspense fallback={<p className="empty">Cargando…</p>}>
            {views[resolvedView]}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
