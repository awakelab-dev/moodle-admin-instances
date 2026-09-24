// Página "Gestión de Notificaciones" (Moodle Insights, exclusiva de
// superadmin): centraliza lo que hoy vive disperso en la configuración
// local del plugin local_courseprogressnotify de cada plataforma — qué
// disparadores están activos, qué plantilla de email usa cada uno, y el
// seguimiento de qué se envió. Ver NOTIFICATIONS_INTEGRATION_PLAN.md (raíz
// del repo) para la arquitectura completa. El plugin en sí no tiene
// interfaz propia: solo guarda la URL de esta app + la API key que se
// genera en la pestaña "Conexión".
import { useEffect, useRef, useState } from 'react';
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
  getNotificationPlatformSettings,
  updateNotificationPlatformSettings,
  getNotificationPlatformCourses,
  getNotificationCustomFieldShortnames,
} from '../api';
import { formatPlatformDisplayName } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import ConfirmDialog from './ConfirmDialog';

const LANGUAGE_LABELS = { es: 'Español', ca: 'Català', en: 'English' };

const EMPTY_TEMPLATE_FORM = { name: '', language: 'es', subject: '', bodyHtml: '' };

// Catálogo completo de placeholders que el plugin sabe rellenar, agrupado
// por disparador (ver classes/task/*.php de local_courseprogressnotify).
// firstname/lastname/coursename los rellena email_builder para CUALQUIER
// disparador; el resto solo existe si la plantilla se asocia al disparador
// correspondiente — un placeholder de otro grupo se queda sin sustituir
// (se envía el email con el texto "{{...}}" literal).
const PLACEHOLDER_GROUPS = [
  {
    label: 'Común (cualquier disparador)',
    items: [
      { key: 'firstname', desc: 'Nombre del alumno' },
      { key: 'lastname', desc: 'Apellidos del alumno' },
      { key: 'coursename', desc: 'Nombre del curso' },
    ],
  },
  {
    label: 'Progreso 25% / 50% / 75%',
    items: [
      { key: 'progress_percentage', desc: '% de progreso alcanzado' },
      { key: 'courseenddate', desc: 'Fecha de fin del curso' },
      { key: 'progress_table', desc: 'Tabla HTML con el detalle por actividad' },
    ],
  },
  {
    label: 'Fin de curso próximo / último día',
    items: [{ key: 'courseenddate', desc: 'Fecha de fin del curso' }],
  },
  {
    label: 'Recordatorio Zoom',
    items: [
      { key: 'zoom_name', desc: 'Nombre de la sesión' },
      { key: 'zoom_date', desc: 'Fecha de la sesión' },
      { key: 'zoom_start', desc: 'Hora de inicio' },
      { key: 'zoom_end', desc: 'Hora de fin' },
      { key: 'zoom_time', desc: 'Rango horario (inicio - fin)' },
      { key: 'zoom_link', desc: 'Enlace a la sesión' },
    ],
  },
  {
    label: 'Examen presencial',
    items: [
      { key: 'exam_location', desc: 'Ubicación del examen' },
      { key: 'exam_date', desc: 'Fecha del examen' },
      { key: 'exam_start', desc: 'Hora de inicio' },
      { key: 'exam_end', desc: 'Hora de fin' },
    ],
  },
  {
    label: 'Tutoría presencial',
    items: [
      { key: 'tutoring_location', desc: 'Ubicación de la tutoría' },
      { key: 'tutoring_date', desc: 'Fecha de la tutoría' },
      { key: 'tutoring_start', desc: 'Hora de inicio' },
      { key: 'tutoring_end', desc: 'Hora de fin' },
    ],
  },
  {
    label: 'Diploma disponible',
    items: [{ key: 'campus_url', desc: 'Enlace al curso en el campus' }],
  },
];

// Inserta {{key}} en la última posición de cursor conocida de un
// <input>/<textarea> controlado. El desplegable de Radix se lleva el foco
// al abrirse (document.activeElement ya no es el campo cuando se elige una
// opción), así que no se puede leer selectionStart/End "en vivo" en ese
// momento — hay que haberlos guardado ANTES, cada vez que el usuario tocó
// o movió el cursor en el campo (ver el onSelect en el input/textarea).
function insertAtCursor(elRef, selectionRef, value, setValue, key) {
  const el = elRef.current;
  const token = `{{${key}}}`;
  const sel = selectionRef.current;
  // Si el campo nunca registró una selección (el usuario no llegó a
  // hacer clic dentro), lo más razonable es añadir al final.
  const start = sel ? Math.min(sel.start, value.length) : value.length;
  const end = sel ? Math.min(sel.end, value.length) : value.length;
  const next = value.slice(0, start) + token + value.slice(end);
  setValue(next);
  const pos = start + token.length;
  selectionRef.current = { start: pos, end: pos };
  requestAnimationFrame(() => {
    if (!el) return;
    el.focus();
    el.setSelectionRange(pos, pos);
  });
}

// Handler de onSelect a pasar al input/textarea — se dispara con cada
// clic, tecla de flecha o cambio de texto que mueva el cursor, así que la
// posición queda guardada de antemano, no hay que leerla justo cuando se
// elige un placeholder (para entonces el campo ya perdió el foco).
function trackSelection(selectionRef) {
  return (e) => {
    selectionRef.current = { start: e.target.selectionStart, end: e.target.selectionEnd };
  };
}

function PlaceholderPicker({ onPick }) {
  // Un mismo placeholder (ej. courseenddate) puede aparecer en más de un
  // grupo porque lo usan varios disparadores — Radix exige valores únicos
  // dentro del mismo <Select>, así que solo se renderiza la primera
  // aparición de cada clave.
  const seen = new Set();
  return (
    <Select value="" onValueChange={onPick}>
      <SelectTrigger style={{ width: 200 }}>
        <SelectValue placeholder="Insertar placeholder…" />
      </SelectTrigger>
      <SelectContent>
        {PLACEHOLDER_GROUPS.map((group) => {
          const items = group.items.filter((item) => {
            if (seen.has(item.key)) return false;
            seen.add(item.key);
            return true;
          });
          if (!items.length) return null;
          return (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {items.map((item) => (
                <SelectItem key={item.key} value={item.key}>
                  <span className="mono">{`{{${item.key}}}`}</span> — {item.desc}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}

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
          <TabsTrigger value="settings">Ajustes por plataforma</TabsTrigger>
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
        <TabsContent value="settings">
          <PlatformSettingsTab flash={flash} />
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
  const subjectRef = useRef(null);
  const bodyRef = useRef(null);
  const subjectSelectionRef = useRef(null);
  const bodySelectionRef = useRef(null);

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
    subjectSelectionRef.current = null;
    bodySelectionRef.current = null;
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
    subjectSelectionRef.current = null;
    bodySelectionRef.current = null;
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
              <div className="config-header" style={{ marginBottom: 0 }}>
                <Label style={{ margin: 0 }}>Asunto</Label>
                <PlaceholderPicker
                  onPick={(key) =>
                    insertAtCursor(
                      subjectRef,
                      subjectSelectionRef,
                      form.subject,
                      (v) => setForm((f) => ({ ...f, subject: v })),
                      key,
                    )
                  }
                />
              </div>
              <Input
                ref={subjectRef}
                type="text"
                placeholder="Vas al 25%, {{firstname}}!"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                onSelect={trackSelection(subjectSelectionRef)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <div className="config-header" style={{ marginBottom: 0 }}>
                <Label style={{ margin: 0 }}>Cuerpo (HTML)</Label>
                <PlaceholderPicker
                  onPick={(key) =>
                    insertAtCursor(
                      bodyRef,
                      bodySelectionRef,
                      form.bodyHtml,
                      (v) => setForm((f) => ({ ...f, bodyHtml: v })),
                      key,
                    )
                  }
                />
              </div>
              <textarea
                ref={bodyRef}
                className="flex w-full rounded-control border border-border-soft bg-surface-muted px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent font-mono"
                rows={10}
                placeholder="<p>Hola {{firstname}}, ya llevas el {{progress_percentage}}% de {{coursename}}...</p>"
                value={form.bodyHtml}
                onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
                onSelect={trackSelection(bodySelectionRef)}
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

// Convierte los params guardados (JSON) en valores de formulario según el
// paramsSchema del disparador: daysBefore como texto numérico, los
// string[] (listas de palabras clave) como texto con una por línea.
function paramsToFormValues(paramsSchema, params) {
  const values = {};
  for (const [key, type] of Object.entries(paramsSchema || {})) {
    const raw = params?.[key];
    if (type === 'string[]') {
      values[key] = Array.isArray(raw) ? raw.join('\n') : '';
    } else {
      values[key] = raw !== undefined && raw !== null ? String(raw) : '';
    }
  }
  return values;
}

function formValuesToParams(paramsSchema, values) {
  const params = {};
  for (const [key, type] of Object.entries(paramsSchema || {})) {
    const raw = values[key];
    if (type === 'string[]') {
      params[key] = String(raw || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (type === 'number') {
      const n = Number(raw);
      params[key] = Number.isFinite(n) && raw !== '' ? n : undefined;
    } else {
      params[key] = raw;
    }
  }
  return params;
}

const PARAM_LABELS = {
  daysBefore: 'Días de antelación',
  examKeywords: 'Palabras clave para detectar exámenes (una por línea)',
  tutoringKeywords: 'Palabras clave para detectar tutorías (una por línea)',
};

function RulesTab({ flash }) {
  const [triggers, setTriggers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingTrigger, setSavingTrigger] = useState(null);
  const [paramsForm, setParamsForm] = useState({}); // { [triggerKey]: { [paramKey]: string } }

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
        const globalRules = rulesData.filter((r) => !r.platformId);
        setRules(globalRules);
        const initialParams = {};
        for (const trigger of triggersData) {
          if (!Object.keys(trigger.paramsSchema || {}).length) continue;
          const rule = globalRules.find((r) => r.trigger === trigger.key);
          initialParams[trigger.key] = paramsToFormValues(trigger.paramsSchema, rule?.params);
        }
        setParamsForm(initialParams);
      })
      .catch((err) => flash(err.message, 'error'))
      .finally(() => setLoading(false));
  }

  function ruleFor(triggerKey) {
    return rules.find((r) => r.trigger === triggerKey) || null;
  }

  async function handleSaveParams(trigger) {
    const rule = ruleFor(trigger.key);
    if (!rule) {
      flash('Elige una plantilla antes de guardar los parámetros.', 'error');
      return;
    }
    setSavingTrigger(trigger.key);
    try {
      const params = formValuesToParams(trigger.paramsSchema, paramsForm[trigger.key] || {});
      await upsertNotificationRule({ trigger: trigger.key, templateId: rule.templateId, isActive: rule.isActive, params });
      flash('Parámetros guardados.');
      load();
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setSavingTrigger(null);
    }
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
          const paramKeys = Object.keys(trigger.paramsSchema || {});
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
                {paramKeys.length > 0 && (
                  <div className="grid gap-2.5" style={{ marginTop: '0.75rem', width: '100%', maxWidth: 420 }}>
                    {paramKeys.map((paramKey) => {
                      const isList = trigger.paramsSchema[paramKey] === 'string[]';
                      return (
                        <div key={paramKey} className="grid gap-1.5">
                          <Label>{PARAM_LABELS[paramKey] || paramKey}</Label>
                          {isList ? (
                            <textarea
                              className="flex w-full rounded-control border border-border-soft bg-surface-muted px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                              rows={3}
                              value={paramsForm[trigger.key]?.[paramKey] ?? ''}
                              onChange={(e) =>
                                setParamsForm((prev) => ({
                                  ...prev,
                                  [trigger.key]: { ...prev[trigger.key], [paramKey]: e.target.value },
                                }))
                              }
                            />
                          ) : (
                            <Input
                              type="number"
                              min="0"
                              value={paramsForm[trigger.key]?.[paramKey] ?? ''}
                              onChange={(e) =>
                                setParamsForm((prev) => ({
                                  ...prev,
                                  [trigger.key]: { ...prev[trigger.key], [paramKey]: e.target.value },
                                }))
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!rule || savingTrigger === trigger.key}
                      onClick={() => handleSaveParams(trigger)}
                    >
                      Guardar parámetros
                    </Button>
                  </div>
                )}
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

// ─── Ajustes por plataforma (campo personalizado + cursos "solo diploma") ───

function PlatformSettingsTab({ flash }) {
  const [platforms, setPlatforms] = useState([]);
  const [platformId, setPlatformId] = useState('');
  const [loadingPlatforms, setLoadingPlatforms] = useState(true);
  const [settings, setSettings] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [courseFilter, setCourseFilter] = useState('');
  const [customFieldOptions, setCustomFieldOptions] = useState([]);

  useEffect(() => {
    getPlatforms()
      .then((data) => {
        const sorted = [...data].sort((a, b) => formatPlatformDisplayName(a.name).localeCompare(formatPlatformDisplayName(b.name)));
        setPlatforms(sorted);
        if (sorted.length) setPlatformId(sorted[0].id);
      })
      .catch((err) => flash(err.message, 'error'))
      .finally(() => setLoadingPlatforms(false));
    getNotificationCustomFieldShortnames()
      .then(setCustomFieldOptions)
      .catch(() => setCustomFieldOptions([]));
  }, []);

  useEffect(() => {
    if (!platformId) return;
    setLoadingDetail(true);
    setCourseFilter('');
    Promise.all([getNotificationPlatformSettings(platformId), getNotificationPlatformCourses(platformId)])
      .then(([settingsData, coursesData]) => {
        setSettings(settingsData);
        setCourses(coursesData);
      })
      .catch((err) => flash(err.message, 'error'))
      .finally(() => setLoadingDetail(false));
  }, [platformId]);

  function toggleDiplomaCourse(courseId) {
    setSettings((prev) => {
      const ids = new Set(prev.diplomaOnlyCourseIds || []);
      if (ids.has(courseId)) ids.delete(courseId);
      else ids.add(courseId);
      return { ...prev, diplomaOnlyCourseIds: Array.from(ids) };
    });
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      const saved = await updateNotificationPlatformSettings(platformId, {
        courseCustomFieldShortname: settings.courseCustomFieldShortname,
        diplomaOnlyCourseIds: settings.diplomaOnlyCourseIds || [],
      });
      setSettings(saved);
      flash('Ajustes guardados.');
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loadingPlatforms) return <p className="empty">Cargando plataformas…</p>;
  if (!platforms.length) return <p className="empty">No hay plataformas configuradas todavía.</p>;

  const filteredCourses = courseFilter
    ? courses.filter((c) => c.courseName.toLowerCase().includes(courseFilter.toLowerCase()))
    : courses;
  const diplomaOnlyIds = new Set(settings?.diplomaOnlyCourseIds || []);

  return (
    <div className="section-stack">
      <p className="panel-description">
        Parámetros propios de cada plataforma (no de un disparador en concreto): el campo
        personalizado de Moodle que activa notificaciones por curso, y qué cursos son "solo
        diploma" (reciben únicamente el email de diploma disponible, sin progreso ni
        recordatorios de fin de curso).
      </p>

      <div className="grid gap-1.5" style={{ maxWidth: 420 }}>
        <Label>Plataforma</Label>
        <Select value={platformId} onValueChange={setPlatformId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {platforms.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {formatPlatformDisplayName(p.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loadingDetail || !settings ? (
        <p className="empty">Cargando ajustes…</p>
      ) : (
        <>
          <div className="grid gap-1.5" style={{ maxWidth: 420 }}>
            <Label>Campo personalizado que activa notificaciones por curso</Label>
            <Input
              type="text"
              list="cpn-customfield-options"
              value={settings.courseCustomFieldShortname || ''}
              onChange={(e) => setSettings({ ...settings, courseCustomFieldShortname: e.target.value })}
            />
            <datalist id="cpn-customfield-options">
              {customFieldOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <p className="history-note">
              Escribe el valor o elígelo de la lista (valores ya usados en otras plataformas). Debe
              coincidir con el "Nombre corto" del campo personalizado (tipo casilla de
              verificación) creado en esta plataforma bajo Administración del sitio → Cursos →
              Campos personalizados del curso.
            </p>
          </div>

          <Card className="p-4">
            <div className="panel-header panel-header-compact">
              <div>
                <p className="eyebrow">Cursos "solo diploma"</p>
                <h3 className="card-title">
                  {diplomaOnlyIds.size} curso{diplomaOnlyIds.size === 1 ? '' : 's'} seleccionado
                  {diplomaOnlyIds.size === 1 ? '' : 's'}
                </h3>
              </div>
            </div>
            <Input
              type="text"
              placeholder="Buscar curso…"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              style={{ marginBottom: '0.75rem' }}
            />
            {!courses.length ? (
              <p className="empty">
                Esta plataforma todavía no tiene cursos sincronizados (ver "Cursos y Alumnos").
              </p>
            ) : (
              <div style={{ maxHeight: 320, overflowY: 'auto', display: 'grid', gap: '0.4rem' }}>
                {filteredCourses.map((course) => (
                  <label
                    key={course.courseId}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.875rem', cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={diplomaOnlyIds.has(course.courseId)}
                      onChange={() => toggleDiplomaCourse(course.courseId)}
                    />
                    {course.courseName}
                  </label>
                ))}
              </div>
            )}
          </Card>

          <div>
            <Button type="button" disabled={saving} onClick={handleSave}>
              {saving ? 'Guardando…' : 'Guardar ajustes'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
