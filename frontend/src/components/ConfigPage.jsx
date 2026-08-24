import { useState, useEffect, useRef } from 'react';
import {
  getPlatforms,
  addPlatform,
  updatePlatform,
  deletePlatform,
  testPlatform,
  triggerPlatformSync,
  cancelSync,
  getSyncStatus,
  invalidateCache,
} from '../api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatPlatformDisplayName } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import ConfirmDialog from './ConfirmDialog';

const EMPTY_FORM = {
  name: '',
  url: '',
  token: '',
  monthlyCharge: '',
};

function getCheckPrefix(status) {
  if (status === 'ok') return '✓';
  if (status === 'error') return '✗';
  return '•';
}

function renderCheckList(title, checks = []) {
  if (!Array.isArray(checks) || checks.length === 0) return null;

  return (
    <div className="test-detail-group">
      <div className="test-detail-title">{title}</div>
      <ul className="test-detail-list">
        {checks.map((check) => (
          <li
            key={`${title}-${check.wsfunction}`}
            className={`test-detail-item test-detail-${check.status}`}
          >
            <span className="test-detail-prefix">{getCheckPrefix(check.status)}</span>
            <span>
              <strong>{check.label}</strong> — <span className="mono">{check.wsfunction}</span>
              {check.message && check.message !== 'OK' ? `: ${check.message}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatLastSync(value) {
  if (!value) return 'Nunca sincronizada';

  try {
    return `Última sincronización: ${new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))}`;
  } catch {
    return 'Nunca sincronizada';
  }
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${seconds}s`;
}

// Página "Configuración": alta/edición/baja de plataformas Moodle, prueba de
// conexión con cada una (test de permisos del Web Service) y disparo de
// sincronizaciones manuales, con seguimiento en vivo del progreso de la
// sincronización en curso (propia o iniciada desde otra sesión/pestaña).
export default function ConfigPage() {
  const [platforms, setPlatforms] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null); // null = adding, number = editing
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [toggleLoading, setToggleLoading] = useState({});
  const [syncLoading, setSyncLoading] = useState({});
  const [syncStartedAt, setSyncStartedAt] = useState({});
  const [syncProgress, setSyncProgress] = useState({});
  const [cancelingSync, setCancelingSync] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const platformsRef = useRef([]);
  const trackedSyncIdsRef = useRef(new Set());
  // Cada sincronización que termina llama a load() para refrescar la lista.
  // Si se sincronizan dos plataformas seguidas, puede haber dos load() en
  // vuelo a la vez — sin esto, si la petición más antigua responde más
  // tarde que la más nueva (orden de red no garantizado), su resultado
  // (más viejo) sobrescribe el más reciente y la plataforma recién
  // sincronizada "desaparece"/vuelve a su estado anterior. Solo se aplica
  // la respuesta si sigue siendo la última petición pedida.
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    if (!Object.values(syncLoading).some(Boolean)) return undefined;
    const intervalId = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, [syncLoading]);

  async function load() {
    const requestId = ++loadRequestIdRef.current;
    try {
      const data = await getPlatforms();
      // Descarta la respuesta si mientras tanto se pidió un load() más
      // nuevo (p. ej. por otra sincronización terminando casi a la vez) —
      // solo la última petición en vuelo puede actualizar el estado.
      if (requestId !== loadRequestIdRef.current) return platformsRef.current;
      setPlatforms(data);
      platformsRef.current = data;
      return data;
    } catch {
      // Un fallo puntual de red no debe vaciar la lista ya cargada — se
      // deja el estado anterior tal cual en vez de mostrar "sin
      // plataformas" por un error transitorio.
      return platformsRef.current;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Vigía continuo: en cualquier momento (no solo al entrar a la página) que
  // haya una sincronización en curso —la hayas lanzado tú o no, esté su
  // tarjeta a la vista o no— la reenganchamos a la barra de progreso de esa
  // plataforma en concreto, para que nunca parezca "salida de la nada".
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const status = await getSyncStatus();
        if (cancelled) return;
        if (status?.status !== 'running' || !status.platform_id) return;

        const platform = platformsRef.current.find((item) => item.id === status.platform_id);
        if (!platform) return;

        const startedAtMs = status.started_at ? new Date(status.started_at).getTime() : Date.now();
        trackSyncOnce(platform, startedAtMs);
      } catch {
        // ignorar errores de sondeo, no interrumpir la vista
      }
    }

    poll();
    const intervalId = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  function finishSyncTracking(platformId) {
    setSyncLoading((prev) => ({ ...prev, [platformId]: false }));
    setSyncStartedAt((prev) => {
      const next = { ...prev };
      delete next[platformId];
      return next;
    });
    setSyncProgress((prev) => {
      const next = { ...prev };
      delete next[platformId];
      return next;
    });
  }

  // Sondea el endpoint de estado de sincronización cada 1.5s hasta que deja
  // de estar "running", actualizando el progreso (porcentaje y paso actual)
  // de la plataforma indicada. Devuelve el estado final (completado/fallido).
  async function pollSyncStatus(platformId) {
    let status;
    do {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      status = await getSyncStatus();
      setSyncProgress((prev) => ({
        ...prev,
        [platformId]: {
          percent:
            status?.items_total > 0
              ? Math.min(100, Math.round((status.items_done / status.items_total) * 100))
              : null,
          step: status?.current_step || null,
        },
      }));
    } while (status?.status === 'running');
    return status;
  }

  // Activa el seguimiento visual (barra de progreso) de la sincronización de
  // una plataforma y espera a que termine vía pollSyncStatus. Al terminar,
  // invalida las cachés de plataformas/cursos y recarga la lista para
  // reflejar los datos recién sincronizados.
  async function trackSync(platform, startedAtMs) {
    setSyncLoading((prev) => ({ ...prev, [platform.id]: true }));
    setSyncStartedAt((prev) => ({ ...prev, [platform.id]: startedAtMs }));
    setSyncProgress((prev) => ({ ...prev, [platform.id]: null }));
    try {
      const status = await pollSyncStatus(platform.id);
      invalidateCache('platforms');
      invalidateCache('courses:');
      await load();
      const lastError = status?.sync_errors?.[status.sync_errors.length - 1];
      if (status?.status === 'failed' && lastError) {
        flash(lastError, 'error');
      } else {
        flash(`"${formatPlatformDisplayName(platform.name)}" sincronizada.`);
      }
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      finishSyncTracking(platform.id);
    }
  }

  function flash(text, type = 'success') {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(p) {
    setForm({
      name: p.name,
      url: p.url,
      token: '',
      monthlyCharge:
        p.monthlyCharge === null || p.monthlyCharge === undefined
          ? ''
          : String(p.monthlyCharge),
    });
    setEditingId(p.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const normalizedMonthlyCharge = String(form.monthlyCharge ?? '').trim();

      if (normalizedMonthlyCharge && Number(normalizedMonthlyCharge) < 0) {
        flash('El monto mensual debe ser mayor o igual a 0.', 'error');
        return;
      }

      if (editingId !== null) {
        const payload = {
          name: form.name,
          url: form.url,
          monthlyCharge: normalizedMonthlyCharge,
        };

        if (form.token) payload.token = form.token;

        await updatePlatform(editingId, payload);
        flash('Plataforma actualizada.');
      } else {
        if (!form.name || !form.url || !form.token) {
          flash('Todos los campos son requeridos.', 'error');
          return;
        }

        await addPlatform({
          ...form,
          monthlyCharge: normalizedMonthlyCharge,
        });
        flash('Plataforma agregada.');
      }
      closeForm();
      await load();
    } catch (err) {
      flash(err.message, 'error');
    }
  }

  function handleDelete(p) {
    setDeleteTarget(p);
  }

  async function confirmDelete() {
    const p = deleteTarget;
    if (!p) return;
    setDeleteTarget(null);
    try {
      await deletePlatform(p.id);
      flash(`"${formatPlatformDisplayName(p.name)}" eliminada.`);
      await load();
    } catch (err) {
      flash(err.message, 'error');
    }
  }

  async function handleTest(p) {
    setTestResults((prev) => ({ ...prev, [p.id]: { loading: true } }));
    try {
      const result = await testPlatform(p.id);
      setTestResults((prev) => ({ ...prev, [p.id]: result }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [p.id]: { success: false, error: err.message },
      }));
    }
  }
  // Evita enganchar el seguimiento (trackSync) más de una vez para la misma
  // plataforma si, por ejemplo, tanto el vigía continuo como handleSyncOne
  // detectan la misma sincronización en curso casi al mismo tiempo.
  function trackSyncOnce(platform, startedAtMs) {
    if (trackedSyncIdsRef.current.has(platform.id)) return;
    trackedSyncIdsRef.current.add(platform.id);
    trackSync(platform, startedAtMs).finally(() => {
      trackedSyncIdsRef.current.delete(platform.id);
    });
  }

  async function handleCancelSync() {
    setCancelingSync(true);
    try {
      await cancelSync();
      flash('Cancelación solicitada. Puede tardar unos segundos en detenerse.');
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setCancelingSync(false);
    }
  }

  // Dispara la sincronización manual de una plataforma. El backend solo
  // permite una sincronización global a la vez: si ya hay una en curso
  // (HTTP 409), se comprueba si es justo la de esta plataforma (para
  // simplemente reenganchar el seguimiento) o de otra distinta (para avisar
  // al usuario que debe esperar).
  async function handleSyncOne(p) {
    try {
      await triggerPlatformSync(p.id);
    } catch (err) {
      if (err.status === 409) {
        // El backend ya tenía una sincronización corriendo — puede ser esta misma
        // plataforma (p.ej. la iniciamos antes de cambiar de pestaña) u otra distinta.
        try {
          const status = await getSyncStatus();
          if (status?.platform_id === p.id) {
            const startedAtMs = status.started_at ? new Date(status.started_at).getTime() : Date.now();
            trackSyncOnce(p, startedAtMs);
            return;
          }
          flash(
            `Ya hay una sincronización en curso${status?.current_platform ? ` (${formatPlatformDisplayName(status.current_platform)})` : ''}. Espera a que termine.`,
            'error'
          );
          return;
        } catch {
          flash('Ya hay una sincronización en curso. Espera a que termine.', 'error');
          return;
        }
      }
      flash(err.message, 'error');
      return;
    }

    trackSyncOnce(p, Date.now());
  }

  async function handleToggleActive(platform) {
    const nextActive = !platform.isActive;
    setToggleLoading((prev) => ({ ...prev, [platform.id]: true }));
    try {
      await updatePlatform(platform.id, { isActive: nextActive });
      setPlatforms((prev) =>
        prev.map((item) =>
          item.id === platform.id ? { ...item, isActive: nextActive } : item
        )
      );
      flash(
        `"${formatPlatformDisplayName(platform.name)}" ${nextActive ? 'activada' : 'desactivada'} para métricas.`
      );
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setToggleLoading((prev) => ({ ...prev, [platform.id]: false }));
    }
  }

  if (loading) return <p className="empty">Cargando configuración…</p>;

  return (
    <div className="section-stack">
      <div className="config-header">
        <div>
          <p className="eyebrow">Administración</p>
          <h2 className="card-title section-title">Plataformas Moodle</h2>
          <p className="panel-description">
            Administra las conexiones, valida credenciales y mantén centralizada la
            configuración técnica y financiera de cada entorno Moodle.
          </p>
          <p className="history-note">
            Costo global aplicado automáticamente: <strong>USD 1 por GB</strong>.
          </p>
        </div>
        <Button onClick={openAdd}>+ Agregar plataforma</Button>
      </div>

      {msg && (
        <Alert variant={msg.type === 'error' ? 'destructive' : 'success'}>
          <AlertDescription>{msg.text}</AlertDescription>
        </Alert>
      )}

      {showForm && (
        <Card className="p-4 pt-4">
          <div className="panel-header panel-header-compact">
            <div>
              <p className="eyebrow">
                {editingId !== null ? 'Edición' : 'Nueva conexión'}
              </p>
              <h3 className="card-title">
                {editingId !== null ? 'Editar plataforma' : 'Nueva plataforma'}
              </h3>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-3.5">
            <div className="grid grid-cols-2 gap-3.5 max-[720px]:grid-cols-1">
              <div className="grid gap-1.5">
                <Label>Nombre</Label>
                <Input
                  type="text"
                  placeholder="Ej: Moodle Producción"
                  autoComplete="off"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>URL</Label>
                <Input
                  type="url"
                  placeholder="https://moodle.ejemplo.com"
                  autoComplete="off"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5 col-span-2 max-[720px]:col-span-1">
                <Label>
                  Token WS
                  {editingId !== null && (
                    <span className="form-hint"> (dejar vacío para mantener el actual)</span>
                  )}
                </Label>
                <Input
                  type="password"
                  placeholder="abc123def456..."
                  autoComplete="new-password"
                  value={form.token}
                  onChange={(e) => setForm({ ...form, token: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Monto mensual cobrado</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ej: 120"
                  autoComplete="off"
                  value={form.monthlyCharge}
                  onChange={(e) =>
                    setForm({ ...form, monthlyCharge: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Costo global por GB</Label>
                <Input type="text" value="USD 1.00" disabled />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2.5">
              <Button type="submit">
                {editingId !== null ? 'Guardar cambios' : 'Agregar'}
              </Button>
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {platforms.length === 0 ? (
        <p className="empty">
          No hay plataformas configuradas. Agrega una para empezar.
        </p>
      ) : (
        <div className="platform-list">
          {platforms.map((p) => (
            <Card key={p.id} className="platform-card p-4">
              <div className="platform-info">
                <div className="platform-name">{formatPlatformDisplayName(p.name)}</div>
                <div className="platform-url">{p.url}</div>
                <div className="platform-token">Token: {p.token}</div>
                <div className="platform-toggle-row flex items-center gap-2.5">
                  <Switch
                    id={`platform-active-${p.id}`}
                    checked={!!p.isActive}
                    onCheckedChange={() => handleToggleActive(p)}
                    disabled={!!toggleLoading[p.id]}
                  />
                  <Label htmlFor={`platform-active-${p.id}`} className="platform-toggle-label cursor-pointer">
                    {p.isActive ? 'Activa en métricas' : 'Inactiva en métricas'}
                  </Label>
                </div>
                <div className="platform-last-sync">
                  {formatLastSync(p.lastSyncedAt)}
                </div>
                <div className="platform-financial">
                  <div className="platform-financial-grid">
                    <span>
                      Cobro mensual:{' '}
                      <strong>{formatCurrency(p.monthlyCharge, p.currency)}</strong>
                    </span>
                    <span>
                      Costo global por GB:{' '}
                      <strong>{formatCurrency(p.costPerGb, p.currency)}</strong>
                    </span>
                    <span>
                      Moneda: <strong>{p.currency || 'USD'}</strong>
                    </span>
                  </div>
                  {!p.hasFinancialConfig && (
                    <div className="platform-financial-pending">
                      Configuración financiera pendiente. Completa el monto mensual
                      para habilitar el margen.
                    </div>
                  )}
                </div>
              </div>
              <div className="platform-actions">
                <Button
                  size="sm"
                  onClick={() => handleTest(p)}
                  disabled={testResults[p.id]?.loading || !!toggleLoading[p.id]}
                >
                  {testResults[p.id]?.loading && <span className="spinner spinner-sm" />}
                  {testResults[p.id]?.loading ? 'Probando…' : 'Probar conexión con plataforma'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSyncOne(p)}
                  disabled={!!syncLoading[p.id] || !!toggleLoading[p.id]}
                >
                  {syncLoading[p.id] && <span className="spinner spinner-sm" />}
                  {syncLoading[p.id] ? 'Sincronizando…' : 'Sincronizar'}
                </Button>
                <Button
                  size="sm"
                  className="bg-[#3b6996] border-[#3b6996] text-white hover:bg-[#4e7ea5] hover:border-[#4e7ea5]"
                  onClick={() => openEdit(p)}
                  disabled={!!toggleLoading[p.id]}
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(p)}
                  disabled={!!toggleLoading[p.id]}
                >
                  Eliminar
                </Button>
              </div>
              {syncLoading[p.id] && (
                <div className="platform-sync-progress">
                  <div className="platform-sync-progress-bar">
                    {typeof syncProgress[p.id]?.percent === 'number' ? (
                      <div
                        className="platform-sync-progress-bar-fill-determinate"
                        style={{ width: `${syncProgress[p.id].percent}%` }}
                      />
                    ) : (
                      <div className="platform-sync-progress-bar-fill" />
                    )}
                  </div>
                  <div className="platform-sync-progress-row">
                    <span className="platform-sync-progress-label">
                      Sincronizando "{formatPlatformDisplayName(p.name)}"
                      {typeof syncProgress[p.id]?.percent === 'number'
                        ? ` — ${syncProgress[p.id].percent}%`
                        : '…'}
                      {syncProgress[p.id]?.step ? ` · ${syncProgress[p.id].step}` : ''}
                      {' · '}
                      {formatElapsed(nowMs - (syncStartedAt[p.id] || nowMs))}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelSync}
                      disabled={cancelingSync}
                    >
                      {cancelingSync && <span className="spinner spinner-sm" />}
                      {cancelingSync ? 'Cancelando…' : 'Cancelar'}
                    </Button>
                  </div>
                </div>
              )}
              {testResults[p.id] && !testResults[p.id].loading && (
                <div
                  className={`test-result ${
                    testResults[p.id].success ? 'test-ok' : 'test-fail'
                  }`}
                >
                  <div className="test-summary">
                    {testResults[p.id].success ? '✓ ' : '✗ '}
                    {testResults[p.id].summary || testResults[p.id].error}
                  </div>
                  {renderCheckList('Permisos requeridos', testResults[p.id].required_checks)}
                  {renderCheckList('Permisos opcionales', testResults[p.id].optional_checks)}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar plataforma"
        message={
          deleteTarget
            ? `¿Eliminar "${formatPlatformDisplayName(deleteTarget.name)}"? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
