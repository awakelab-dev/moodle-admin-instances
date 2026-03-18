import { useState, useEffect } from 'react';
import {
  getPlatforms,
  addPlatform,
  updatePlatform,
  deletePlatform,
  testPlatform,
} from '../api';

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

function formatCurrency(value, currency = 'USD') {
  if (!Number.isFinite(Number(value))) return '—';

  try {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch {
    return `${new Intl.NumberFormat('es-CL', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(value))} ${currency || ''}`.trim();
  }
}

export default function ConfigPage() {
  const [platforms, setPlatforms] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null); // null = adding, number = editing
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [toggleLoading, setToggleLoading] = useState({});

  async function load() {
    try {
      const data = await getPlatforms();
      setPlatforms(data);
    } catch {
      setPlatforms([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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

  async function handleDelete(p) {
    if (!confirm(`¿Eliminar "${p.name}"?`)) return;
    try {
      await deletePlatform(p.id);
      flash(`"${p.name}" eliminada.`);
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
        `"${platform.name}" ${nextActive ? 'activada' : 'desactivada'} para métricas.`
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
        <button className="btn-add" onClick={openAdd}>
          + Agregar plataforma
        </button>
      </div>

      {msg && (
        <div className={`config-msg ${msg.type}`}>
          {msg.text}
        </div>
      )}

      {showForm && (
        <div className="card config-form-card">
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
          <form onSubmit={handleSubmit} className="config-form">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Ej: Moodle Producción"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">URL</label>
                <input
                  className="form-input"
                  type="url"
                  placeholder="https://moodle.ejemplo.com"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              </div>
              <div className="form-group form-group-full">
                <label className="form-label">
                  Token WS
                  {editingId !== null && (
                    <span className="form-hint"> (dejar vacío para mantener el actual)</span>
                  )}
                </label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="abc123def456..."
                  value={form.token}
                  onChange={(e) => setForm({ ...form, token: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Monto mensual cobrado</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ej: 120"
                  value={form.monthlyCharge}
                  onChange={(e) =>
                    setForm({ ...form, monthlyCharge: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Costo global por GB</label>
                <input
                  className="form-input"
                  type="text"
                  value="USD 1.00"
                  disabled
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="sync-btn sync-btn-compact">
                {editingId !== null ? 'Guardar cambios' : 'Agregar'}
              </button>
              <button type="button" className="btn-cancel" onClick={closeForm}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {platforms.length === 0 ? (
        <p className="empty">
          No hay plataformas configuradas. Agrega una para empezar.
        </p>
      ) : (
        <div className="platform-list">
          {platforms.map((p) => (
            <div key={p.id} className="card platform-card">
              <div className="platform-info">
                <div className="platform-name">{p.name}</div>
                <div className="platform-url">{p.url}</div>
                <div className="platform-token">Token: {p.token}</div>
                <div className="platform-toggle-row">
                  <label className="platform-toggle" htmlFor={`platform-active-${p.id}`}>
                    <input
                      id={`platform-active-${p.id}`}
                      type="checkbox"
                      checked={!!p.isActive}
                      onChange={() => handleToggleActive(p)}
                      disabled={!!toggleLoading[p.id]}
                    />
                    <span className="platform-toggle-slider" aria-hidden="true" />
                    <span className="platform-toggle-label">
                      {p.isActive ? 'Activa en métricas' : 'Inactiva en métricas'}
                    </span>
                  </label>
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
                <button
                  className="btn-sm btn-test"
                  onClick={() => handleTest(p)}
                  disabled={testResults[p.id]?.loading || !!toggleLoading[p.id]}
                >
                  {testResults[p.id]?.loading && <span className="spinner spinner-sm" />}
                  {testResults[p.id]?.loading ? 'Probando…' : 'Probar'}
                </button>
                <button
                  className="btn-sm btn-edit"
                  onClick={() => openEdit(p)}
                  disabled={!!toggleLoading[p.id]}
                >
                  Editar
                </button>
                <button
                  className="btn-sm btn-delete"
                  onClick={() => handleDelete(p)}
                  disabled={!!toggleLoading[p.id]}
                >
                  Eliminar
                </button>
              </div>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
