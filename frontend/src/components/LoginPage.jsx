import { useState } from 'react';

const INITIAL_FORM = {
  username: '',
  password: '',
};

export default function LoginPage({ onLogin, notice = null }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();

    const username = form.username.trim();
    const password = form.password;

    if (!username || !password) {
      setError('Ingresa usuario y contraseña.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onLogin({ username, password });
    } catch (err) {
      setError(err?.message || 'No fue posible iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  }

  const bannerMessage = error || notice;
  const bannerClass = error
    ? 'login-banner login-banner-error'
    : notice
      ? 'login-banner login-banner-info'
      : '';

  return (
    <div className="login-screen">
      <div className="login-shell">
        <div className="login-card">
          <img
            className="login-brand-logo"
            src="/login/logo-aulacloner.svg"
            alt="Aulacloner"
          />

          {bannerMessage && (
            <div className={bannerClass} role="alert">
              {bannerMessage}
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label className="login-label" htmlFor="login-username">
                Nombre Usuario
              </label>
              <input
                id="login-username"
                name="username"
                className="login-input"
                type="text"
                placeholder="User name"
                autoComplete="username"
                value={form.username}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, username: event.target.value }))
                }
              />
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="login-password">
                Contraseña
              </label>
              <input
                id="login-password"
                name="password"
                className="login-input"
                type="password"
                placeholder="Password"
                autoComplete="current-password"
                value={form.password}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, password: event.target.value }))
                }
              />
            </div>

            <button type="submit" className="login-submit" disabled={submitting}>
              {submitting && <span className="spinner" />}
              {submitting ? 'Ingresando…' : 'Iniciar sesión'}
            </button>
          </form>

          <div className="login-divider" />
          <p className="login-help-text">Contacta a tu administrador para acceder</p>
        </div>
      </div>

      <div className="login-powered-by">
        <img src="/login/logo-powered-by.svg" alt="Powered by Awakelab" />
      </div>
    </div>
  );
}
