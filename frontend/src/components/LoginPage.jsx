import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

const INITIAL_FORM = {
  username: '',
  password: '',
};

export default function LoginPage({ onLogin, notice = null }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

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
  const bannerVariant = error ? 'destructive' : notice ? 'default' : null;

  return (
    <div className="login-screen">
      <div className="login-shell">
        <div className="login-card">
          <img
            className="login-brand-logo"
            src="/login/logo-aulacloner.svg"
            alt="Moodle Insights"
          />

          {bannerMessage && (
            <Alert variant={bannerVariant} className="mb-4">
              <AlertDescription>{bannerMessage}</AlertDescription>
            </Alert>
          )}

          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-1.5">
              <Label htmlFor="login-username" className="text-white">
                Nombre Usuario
              </Label>
              <Input
                id="login-username"
                name="username"
                type="text"
                placeholder="User name"
                autoComplete="username"
                spellCheck={false}
                value={form.username}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, username: event.target.value }))
                }
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="login-password" className="text-white">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  autoComplete="current-password"
                  spellCheck={false}
                  className="pr-10"
                  value={form.password}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <span className="spinner" />}
              {submitting ? 'Ingresando…' : 'Iniciar sesión'}
            </Button>
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
