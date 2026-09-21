// Página "Gestión de Notificaciones" (Moodle Insights, exclusiva de
// superadmin): centraliza lo que hoy vive disperso en la configuración
// local del plugin local_courseprogressnotify de cada plataforma — qué
// disparadores están activos, qué plantilla de email usa cada uno, y el
// seguimiento de qué se envió. Ver NOTIFICATIONS_INTEGRATION_PLAN.md (raíz
// del repo) para la arquitectura completa. El plugin en sí no tiene
// interfaz propia: solo guarda la URL de esta app + la API key que se
// genera en la pestaña "Conexión".
import { useEffect, useState } from 'react';
import {
  getNotificationTriggers,
  getNotificationTemplates,
  createNotificationTemplate,
  updateNotificationTemplate,
  deleteNotificationTemplate,
  getNotificationRules,
  upsertNotificationRule,
  getNotificationDeliveryLog,
  getPlatforms,
  generateNotificationsApiKey,
  revokeNotificationsApiKey,
} from '../api';
import { formatPlatformDisplayName } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import ConfirmDialog from './ConfirmDialog';

const LANGUAGE_LABELS = { es: 'Español', ca: 'Català', en: 'English' };

const EMPTY_TEMPLATE_FORM = { name: '', language: 'es', subject: '', bodyHtml: '' };

export default function NotificationsPage() {
  const [tab, setTab] = useState('templates');
  const [msg, setMsg] = useState(null);

  function flash(text, type = 'success') {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  }

  return (
    <div className="section-stack">
      <div className="config-header">
        <div>
          <p className="eyebrow">Moodle Insights</p>
          <h2 className="card-title section-title">Gestión de Notificaciones</h2>
          <p className="panel-description">
            Envío automático de emails a alumnos (progreso, fin de curso, Zoom, sesiones
            presenciales, diploma, primer/segundo día). El plugin instalado en cada plataforma no
            tiene configuración propia — todo se controla desde aquí.
          </p>
        </div>
      </div>

      {msg && (
        <Alert variant={msg.type === 'error' ? 'destructive' : 'success'}>
          <AlertDescription>{msg.text}</AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Secciones de Gestión de Notificaciones">
          <TabsTrigger value="templates">Plantillas</TabsTrigger>
          <TabsTrigger value="rules">Disparadores</TabsTrigger>
          <TabsTrigger value="log">Seguimiento</TabsTrigger>
          <TabsTrigger value="connection">Conexión</TabsTrigger>
        </TabsList>
        <TabsContent value="templates">
          <TemplatesTab flash={flash} />
        </TabsContent>
        <TabsContent value="rules">
          <RulesTab flash={flash} />
        </TabsContent>
        <TabsContent value="log">
          <DeliveryLogTab />
        </TabsContent>
        <TabsContent value="connection">
          <ConnectionTab flash={flash} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Plantillas ───

function TemplatesTab({ flash }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_TEMPLATE_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    getNotificationTemplates()
      .then(setTemplates)
      .catch((err) => flash(err.message, 'error'))
      .finally(() => setLoading(false));
  }

  function openAdd() {
    setForm(EMPTY_TEMPLATE_FORM);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(template) {
    setForm({
      name: template.name,
      language: template.language,
      subject: template.subject,
      bodyHtml: template.bodyHtml,
    });
    setEditingId(template.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_TEMPLATE_FORM);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId !== null) {
        await updateNotificationTemplate(editingId, form);
        flash('Plantilla actualizada.');
      } else {
        await createNotificationTemplate(form);
        flash('Plantilla creada.');
      }
      closeForm();
      load();
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteNotificationTemplate(deleteTarget.id);
      flash(`Plantilla "${deleteTarget.name}" eliminada.`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      flash(err.message, 'error');
      setDeleteTarget(null);
    }
  }

  if (loading) return <p className="empty">Cargando plantillas…</p>;

  return (
    <div className="section-stack">
      <div className="config-header">
        <p className="panel-description" style={{ margin: 0 }}>
          Placeholders disponibles: <span className="mono">{'{{firstname}}'}</span>{' '}
          <span className="mono">{'{{lastname}}'}</span> <span className="mono">{'{{coursename}}'}</span>{' '}
          <span className="mono">{'{{progress_percentage}}'}</span> — y más según el disparador.
        </p>
        <Button onClick={openAdd}>+ Nueva plantilla</Button>
      </div>

      {showForm && (
        <Card className="p-4 pt-4">
          <div className="panel-header panel-header-compact">
            <div>
              <p className="eyebrow">{editingId !== null ? 'Edición' : 'Nueva plantilla'}</p>
              <h3 className="card-title">{editingId !== null ? 'Editar plantilla' : 'Nueva plantilla'}</h3>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-3.5" noValidate>
            <div className="grid grid-cols-2 gap-3.5 max-[720px]:grid-cols-1">
              <div className="grid gap-1.5">
                <Label>Nombre interno</Label>
                <Input
                  type="text"
                  placeholder="Progreso 25% - ES"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Idioma</Label>
                <Select value={form.language} onValueChange={(value) => setForm({ ...form, language: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Asunto</Label>
              <Input
                type="text"
                placeholder="Vas al 25%, {{firstname}}!"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Cuerpo (HTML)</Label>
              <textarea
                className="flex w-full rounded-control border border-border-soft bg-surface-muted px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent font-mono"
                rows={10}
                placeholder="<p>Hola {{firstname}}, ya llevas el {{progress_percentage}}% de {{coursename}}...</p>"
                value={form.bodyHtml}
                onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
                required
              />
            </div>
            <div className="flex gap-2.5">
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando…' : editingId !== null ? 'Guardar cambios' : 'Crear plantilla'}
              </Button>
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {!templates.length ? (
        <p className="empty">No hay plantillas creadas todavía.</p>
      ) : (
        <div className="platform-list">
          {templates.map((template) => (
            <Card key={template.id} className="platform-card p-4">
              <div className="platform-info">
                <div className="platform-name">{template.name}</div>
                <div className="platform-url">{template.subject}</div>
                <Badge variant="outline">{LANGUAGE_LABELS[template.language] || template.language}</Badge>
              </div>
              <div className="platform-actions">
                <Button type="button" variant="outline" onClick={() => openEdit(template)}>
                  Editar
                </Button>
                <Button type="button" variant="destructive" onClick={() => setDeleteTarget(template)}>
                  Eliminar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar plantilla"
        message={deleteTarget ? `¿Eliminar la plantilla "${deleteTarget.name}"? Esta acción no se puede deshacer.` : ''}
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ─── Disparadores (reglas globales trigger -> plantilla) ───

function RulesTab({ flash }) {
  const [triggers, setTriggers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingTrigger, setSavingTrigger] = useState(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    Promise.all([getNotificationTriggers(), getNotificationTemplates(), getNotificationRules()])
      .then(([triggersData, templatesData, rulesData]) => {
        setTriggers(triggersData);
        setTemplates(templatesData);
        // Solo interesan aquí las reglas globales (platformId null) — las
        // específicas por plataforma quedan para una vista futura.
        setRules(rulesData.filter((r) => !r.platformId));
      })
      .catch((err) => flash(err.message, 'error'))
      .finally(() => setLoading(false));
  }

  function ruleFor(triggerKey) {
    return rules.find((r) => r.trigger === triggerKey) || null;
  }

  async function handleTemplateChange(triggerKey, templateId) {
    if (!templateId) return;
    setSavingTrigger(triggerKey);
    try {
      const existing = ruleFor(triggerKey);
      await upsertNotificationRule({ trigger: triggerKey, templateId, isActive: existing?.isActive ?? true });
      flash('Disparador actualizado.');
      load();
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setSavingTrigger(null);
    }
  }

  async function handleToggleActive(triggerKey) {
    const existing = ruleFor(triggerKey);
    if (!existing) {
      flash('Elige una plantilla antes de activar este disparador.', 'error');
      return;
    }
    setSavingTrigger(triggerKey);
    try {
      await upsertNotificationRule({ trigger: triggerKey, templateId: existing.templateId, isActive: !existing.isActive });
      load();
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setSavingTrigger(null);
    }
  }

  if (loading) return <p className="empty">Cargando disparadores…</p>;

  return (
    <div className="section-stack">
      <p className="panel-description">
        Plantilla global usada por cada disparador (aplica a todas las plataformas conectadas).
        Un disparador sin plantilla asignada no envía ningún email.
      </p>
      {!templates.length && (
        <p className="empty">Crea al menos una plantilla en la pestaña "Plantillas" antes de configurar disparadores.</p>
      )}
      <div className="platform-list">
        {triggers.map((trigger) => {
          const rule = ruleFor(trigger.key);
          return (
            <Card key={trigger.key} className="platform-card p-4">
              <div className="platform-info">
                <div className="platform-name">{trigger.label}</div>
                <div className="platform-url">
                  {rule ? (
                    <Badge variant={rule.isActive ? 'secondary' : 'outline'}>
                      {rule.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  ) : (
                    <span className="muted">Sin plantilla asignada</span>
                  )}
                </div>
              </div>
              <div className="platform-actions" style={{ alignItems: 'center', gap: '0.75rem' }}>
                <Select
                  value={rule?.templateId || ''}
                  onValueChange={(value) => handleTemplateChange(trigger.key, value)}
                  disabled={savingTrigger === trigger.key || !templates.length}
                >
                  <SelectTrigger style={{ minWidth: 220 }}>
                    <SelectValue placeholder="Elegir plantilla" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({LANGUAGE_LABELS[t.language] || t.language})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!rule || savingTrigger === trigger.key}
                  onClick={() => handleToggleActive(trigger.key)}
                >
                  {rule?.isActive ? 'Desactivar' : 'Activar'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Seguimiento (log de envíos) ───

function DeliveryLogTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getNotificationDeliveryLog({ limit: 200 })
      .then(setEntries)
      .catch(() => setError('No se pudo cargar el seguimiento de envíos.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="empty">Cargando seguimiento…</p>;
  if (error) return <p className="empty error">{error}</p>;
  if (!entries.length) return <p className="empty">Todavía no se ha registrado ningún envío.</p>;

  return (
    <div className="table-wrapper insights-table-wrapper">
      <Table className="course-table">
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Plataforma</TableHead>
            <TableHead>Disparador</TableHead>
            <TableHead>Curso</TableHead>
            <TableHead>Alumno (id Moodle)</TableHead>
            <TableHead>Resultado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>{new Date(entry.sentAt).toLocaleString('es-CL')}</TableCell>
              <TableCell>{formatPlatformDisplayName(entry.platform?.name || '')}</TableCell>
              <TableCell className="mono">{entry.trigger}</TableCell>
              <TableCell className="mono">{entry.courseId}</TableCell>
              <TableCell className="mono">{entry.userId}</TableCell>
              <TableCell>
                <Badge variant={entry.success ? 'secondary' : 'destructive'} title={entry.errorMessage || ''}>
                  {entry.success ? 'Enviado' : 'Fallo'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Conexión (API key por plataforma, para el plugin) ───

function ConnectionTab({ flash }) {
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [revealedKey, setRevealedKey] = useState(null); // { platformId, key }

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    getPlatforms()
      .then((data) => setPlatforms([...data].sort((a, b) => formatPlatformDisplayName(a.name).localeCompare(formatPlatformDisplayName(b.name)))))
      .catch((err) => flash(err.message, 'error'))
      .finally(() => setLoading(false));
  }

  async function handleGenerate(platform) {
    setBusyId(platform.id);
    setRevealedKey(null);
    try {
      const { apiKey } = await generateNotificationsApiKey(platform.id);
      setRevealedKey({ platformId: platform.id, key: apiKey });
      load();
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevoke(platform) {
    setBusyId(platform.id);
    try {
      await revokeNotificationsApiKey(platform.id);
      flash(`API key de notificaciones revocada para "${formatPlatformDisplayName(platform.name)}".`);
      if (revealedKey?.platformId === platform.id) setRevealedKey(null);
      load();
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="empty">Cargando plataformas…</p>;

  return (
    <div className="section-stack">
      <p className="panel-description">
        Cada plataforma necesita su propia API key para que el plugin{' '}
        <span className="mono">local_courseprogressnotify</span> instalado ahí pueda conectarse a
        Moodle Insights. La key solo se muestra una vez al generarla — pégala en la configuración
        del plugin en esa plataforma antes de cerrar esta ventana.
      </p>
      <div className="platform-list">
        {platforms.map((platform) => (
          <Card key={platform.id} className="platform-card p-4">
            <div className="platform-info">
              <div className="platform-name">{formatPlatformDisplayName(platform.name)}</div>
              <div className="platform-url">
                <Badge variant={platform.hasNotificationsApiKey ? 'secondary' : 'outline'}>
                  {platform.hasNotificationsApiKey ? 'Conectada' : 'Sin conectar'}
                </Badge>
              </div>
              {revealedKey?.platformId === platform.id && (
                <>
                  <p className="history-note mono" style={{ wordBreak: 'break-all' }}>
                    {revealedKey.key}
                  </p>
                  <p className="history-note" style={{ color: 'var(--color-danger)' }}>
                    Cópiala ahora — no se volverá a mostrar.
                  </p>
                </>
              )}
            </div>
            <div className="platform-actions">
              <Button type="button" variant="outline" disabled={busyId === platform.id} onClick={() => handleGenerate(platform)}>
                {platform.hasNotificationsApiKey ? 'Regenerar key' : 'Generar key'}
              </Button>
              {platform.hasNotificationsApiKey && (
                <Button type="button" variant="destructive" disabled={busyId === platform.id} onClick={() => handleRevoke(platform)}>
                  Revocar
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
