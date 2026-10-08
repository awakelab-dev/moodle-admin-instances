// Página "Gestión de Notificaciones" (Moodle Insights, exclusiva de
// superadmin): centraliza lo que hoy vive disperso en la configuración
// local del plugin local_courseprogressnotify de cada plataforma — qué
// disparadores están activos, qué plantilla de email usa cada uno, y el
// seguimiento de qué se envió. Ver NOTIFICATIONS_INTEGRATION_PLAN.md (raíz
// del repo) para la arquitectura completa. El plugin en sí no tiene
// interfaz propia: solo guarda la URL de esta app + la API key que se
// genera en la pestaña "Conexión".
import { Fragment, useEffect, useRef, useState } from 'react';
import {
  getNotificationTriggers,
  getNotificationTemplates,
  createNotificationTemplate,
  updateNotificationTemplate,
  deleteNotificationTemplate,
  getNotificationRules,
  upsertNotificationRule,
  upsertNotificationTriggerVariants,
  deleteNotificationTriggerVariants,
  getNotificationDeliveryLog,
  getPlatforms,
  generateNotificationsApiKey,
  revokeNotificationsApiKey,
  getNotificationPlatformSettings,
  updateNotificationPlatformSettings,
  getNotificationPlatformCourses,
  getNotificationPlatformCategories,
  getNotificationCustomFieldShortnames,
  getNotificationTemplateHistory,
} from '../api';
import { formatPlatformDisplayName } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import RichTextEditor from './RichTextEditor';

const LANGUAGE_LABELS = { es: 'Español', ca: 'Català', en: 'English' };

// Solo para mostrar un vistazo de texto plano en el historial — el HTML
// real de la plantilla no se toca ni se renderiza en ningún otro sitio.
function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

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
  // Radix <Select> solo dispara onValueChange cuando el valor elegido
  // difiere del que recibió la última vez — con value="" siempre fijo
  // desde fuera, elegir el MISMO placeholder dos veces seguidas no
  // disparaba nada la segunda vez (visto en QA). Forzar un remount
  // completo tras cada elección resetea ese estado interno.
  const [resetKey, setResetKey] = useState(0);
  return (
    <Select key={resetKey} value="" onValueChange={(value) => { onPick(value); setResetKey((k) => k + 1); }}>
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
        // Posición fija (no en el flujo normal del documento) — QA encontró
        // que como alerta inline empujaba hacia abajo el resto de la
        // pantalla al aparecer/desaparecer (ej. el interruptor maestro de
        // "Ajustes por plataforma" cambiaba de sitio unos segundos después
        // de tocarlo), pudiendo hacer que un clic siguiente caiga fuera de
        // sitio.
        // (Abajo a la derecha, no arriba — en QA tapaba el botón "Tema
        // claro"/"Tema oscuro" de la cabecera.)
        <div style={{ position: 'fixed', bottom: '1.25rem', right: '1.25rem', zIndex: 50, maxWidth: 420 }}>
          <Alert variant={msg.type === 'error' ? 'destructive' : 'success'}>
            <AlertDescription>{msg.text}</AlertDescription>
          </Alert>
        </div>
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
  const bodyEditorRef = useRef(null);
  const subjectSelectionRef = useRef(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const formCardRef = useRef(null);

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

  // Al abrir el formulario, el botón que lo dispara puede estar bastante
  // más abajo que el formulario en sí (lista larga de plantillas) — sin
  // este scroll, "Editar" parecía no hacer nada (visto en QA).
  function scrollToForm() {
    requestAnimationFrame(() => formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function openAdd() {
    setForm(EMPTY_TEMPLATE_FORM);
    setEditingId(null);
    setShowForm(true);
    subjectSelectionRef.current = null;
    scrollToForm();
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
    scrollToForm();
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
        <Card ref={formCardRef} className="p-4 pt-4">
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
                onKeyDown={(e) => {
                  // Enter en este campo no debe enviar el formulario a
                  // medias (visto en QA) — solo "Crear/Guardar plantilla".
                  if (e.key === 'Enter') e.preventDefault();
                }}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <div className="config-header" style={{ marginBottom: 0 }}>
                <Label style={{ margin: 0 }}>Cuerpo del email</Label>
                <PlaceholderPicker onPick={(key) => bodyEditorRef.current?.insertPlaceholder(key)} />
              </div>
              <RichTextEditor
                ref={bodyEditorRef}
                value={form.bodyHtml}
                onChange={(html) => setForm((f) => ({ ...f, bodyHtml: html }))}
                placeholder="Hola {{firstname}}, ya llevas el {{progress_percentage}}% de {{coursename}}…"
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
                <Button type="button" variant="outline" onClick={() => setHistoryTarget(template)}>
                  Historial
                </Button>
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

      <TemplateHistoryDialog template={historyTarget} onClose={() => setHistoryTarget(null)} />
    </div>
  );
}

const HISTORY_ACTION_LABELS = {
  created: 'Creada',
  updated: 'Editada',
  deleted: 'Eliminada',
};

function TemplateHistoryDialog({ template, onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!template) return;
    setLoading(true);
    getNotificationTemplateHistory(template.id)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [template]);

  if (!template) return null;

  return (
    <div className="confirm-dialog-overlay" onClick={onClose}>
      <Card className="confirm-dialog-card p-4" style={{ maxWidth: 640, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="card-title">Historial de "{template.name}"</h3>
        {loading ? (
          <p className="empty">Cargando historial…</p>
        ) : !entries.length ? (
          <p className="empty">Todavía no hay cambios registrados para esta plantilla.</p>
        ) : (
          <div style={{ maxHeight: 420, overflowY: 'auto', display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
            {entries.map((entry) => (
              <Card key={entry.id} className="p-3">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                  <Badge variant={entry.action === 'deleted' ? 'destructive' : 'secondary'}>
                    {HISTORY_ACTION_LABELS[entry.action] || entry.action}
                  </Badge>
                  <span className="history-note" style={{ margin: 0 }}>
                    {entry.changedByUsername} · {new Date(entry.changedAt).toLocaleString('es-CL')}
                  </span>
                </div>
                {entry.action === 'updated' && (
                  <>
                    <div className="grid grid-cols-2 gap-2.5 max-[560px]:grid-cols-1" style={{ marginTop: '0.6rem' }}>
                      <div>
                        <p className="eyebrow" style={{ marginBottom: '0.25rem' }}>Antes (asunto)</p>
                        <p className="mono history-note" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                          {entry.previousData?.subject}
                        </p>
                      </div>
                      <div>
                        <p className="eyebrow" style={{ marginBottom: '0.25rem' }}>Después (asunto)</p>
                        <p className="mono history-note" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                          {entry.newData?.subject}
                        </p>
                      </div>
                    </div>
                    {entry.previousData?.bodyHtml !== entry.newData?.bodyHtml && (
                      <div className="grid grid-cols-2 gap-2.5 max-[560px]:grid-cols-1" style={{ marginTop: '0.6rem' }}>
                        <div>
                          <p className="eyebrow" style={{ marginBottom: '0.25rem' }}>Antes (cuerpo)</p>
                          <p className="history-note" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                            {stripHtml(entry.previousData?.bodyHtml)}
                          </p>
                        </div>
                        <div>
                          <p className="eyebrow" style={{ marginBottom: '0.25rem' }}>Después (cuerpo)</p>
                          <p className="history-note" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                            {stripHtml(entry.newData?.bodyHtml)}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Card>
            ))}
          </div>
        )}
        <div className="confirm-dialog-actions" style={{ marginTop: '1rem' }}>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </Card>
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

// Espejo de VARIANT_PARAM_DEFS en el backend (notification-triggers.constants.ts)
// — solo para etiquetas/unidad en esta UI, la validación real vive allá.
const VARIANT_PARAM_DEFS = {
  grades: { label: 'Calificaciones aprobadas', unit: '%', higherIsBetter: true },
  attendance: { label: 'Asistencia (sesiones presenciales/Zoom)', unit: '%', higherIsBetter: true },
  inactivity_risk: { label: 'Riesgo de abandono (días sin acceder)', unit: 'días', higherIsBetter: false },
};

function RulesTab({ flash }) {
  const [triggers, setTriggers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [rules, setRules] = useState([]);
  const [savedVariantsByTrigger, setSavedVariantsByTrigger] = useState({}); // { [triggerKey]: boolean } — para saber si "Quitar variantes" aplica de verdad
  const [loading, setLoading] = useState(true);
  const [savingTrigger, setSavingTrigger] = useState(null);
  const [paramsForm, setParamsForm] = useState({}); // { [triggerKey]: { [paramKey]: string } }
  const [variantForm, setVariantForm] = useState({}); // { [triggerKey]: { variantParam, positiveTemplateId, negativeTemplateId, threshold } }
  const [removeVariantsTarget, setRemoveVariantsTarget] = useState(null);

  useEffect(() => {
    load(true);
  }, []);

  // `isInitial` solo se pasa en el useEffect de montaje — las recargas tras
  // guardar NO deben pasar por el "Cargando disparadores…" de abajo (eso
  // colapsaba toda la lista un instante y hacía saltar el scroll arriba,
  // visto en QA). Los datos se actualizan igual, solo que sin el parpadeo.
  function load(isInitial = false) {
    if (isInitial) setLoading(true);
    Promise.all([getNotificationTriggers(), getNotificationTemplates(), getNotificationRules()])
      .then(([triggersData, templatesData, rulesData]) => {
        setTriggers(triggersData);
        setTemplates(templatesData);
        // Solo interesan aquí las reglas globales (platformId null) — las
        // específicas por plataforma quedan para una vista futura.
        const globalRules = rulesData.filter((r) => !r.platformId && !r.variant);
        setRules(globalRules);
        const globalVariantRules = rulesData.filter((r) => !r.platformId && r.variant);
        const initialParams = {};
        const initialVariants = {};
        const savedVariants = {};
        for (const trigger of triggersData) {
          if (Object.keys(trigger.paramsSchema || {}).length) {
            const rule = globalRules.find((r) => r.trigger === trigger.key);
            initialParams[trigger.key] = paramsToFormValues(trigger.paramsSchema, rule?.params);
          }
          if (trigger.variantParams?.length) {
            const positive = globalVariantRules.find((r) => r.trigger === trigger.key && r.variant === 'positive');
            const negative = globalVariantRules.find((r) => r.trigger === trigger.key && r.variant === 'negative');
            const existingParam = positive?.params?.variantParam ?? negative?.params?.variantParam;
            savedVariants[trigger.key] = Boolean(positive || negative);
            initialVariants[trigger.key] = {
              variantParam: existingParam || trigger.variantParams[0],
              positiveTemplateId: positive?.templateId || '',
              negativeTemplateId: negative?.templateId || '',
              threshold: String(positive?.params?.threshold ?? negative?.params?.threshold ?? 50),
            };
          }
        }
        setParamsForm(initialParams);
        setVariantForm(initialVariants);
        setSavedVariantsByTrigger(savedVariants);
      })
      .catch((err) => flash(err.message, 'error'))
      .finally(() => {
        if (isInitial) setLoading(false);
      });
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

  async function handleSaveVariants(trigger) {
    const form = variantForm[trigger.key] || {};
    if (!form.variantParam) {
      flash('Elige qué parámetro decide la variante.', 'error');
      return;
    }
    if (!form.positiveTemplateId || !form.negativeTemplateId) {
      flash('Elige las 2 plantillas (positiva y negativa) antes de guardar.', 'error');
      return;
    }
    const threshold = Number(form.threshold);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 365) {
      flash('El umbral debe ser un número válido.', 'error');
      return;
    }
    setSavingTrigger(trigger.key);
    try {
      await upsertNotificationTriggerVariants({
        trigger: trigger.key,
        variantParam: form.variantParam,
        positiveTemplateId: form.positiveTemplateId,
        negativeTemplateId: form.negativeTemplateId,
        threshold,
      });
      flash('Variantes guardadas.');
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
            <Fragment key={trigger.key}>
            <Card className="platform-card p-4">
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
            {trigger.variantParams?.length > 0 && (
              <TriggerVariantCard
                trigger={trigger}
                templates={templates}
                form={
                  variantForm[trigger.key] || {
                    variantParam: trigger.variantParams[0],
                    positiveTemplateId: '',
                    negativeTemplateId: '',
                    threshold: '50',
                  }
                }
                hasSavedVariants={Boolean(savedVariantsByTrigger[trigger.key])}
                onChange={(next) => setVariantForm((prev) => ({ ...prev, [trigger.key]: next }))}
                onSave={() => handleSaveVariants(trigger)}
                onRemove={() => setRemoveVariantsTarget(trigger)}
                saving={savingTrigger === trigger.key}
              />
            )}
            </Fragment>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(removeVariantsTarget)}
        title="Quitar variantes"
        message={
          removeVariantsTarget
            ? `¿Quitar las plantillas de variante de "${removeVariantsTarget.label}"? Este disparador volverá a usar solo la plantilla única de arriba.`
            : ''
        }
        confirmLabel="Quitar variantes"
        onConfirm={async () => {
          const trigger = removeVariantsTarget;
          setRemoveVariantsTarget(null);
          setSavingTrigger(trigger.key);
          try {
            await deleteNotificationTriggerVariants(trigger.key);
            flash('Variantes eliminadas — vuelve a usar la plantilla única de arriba.');
            load();
          } catch (err) {
            flash(err.message, 'error');
          } finally {
            setSavingTrigger(null);
          }
        }}
        onCancel={() => setRemoveVariantsTarget(null)}
      />
    </div>
  );
}

function TriggerVariantCard({ trigger, templates, form, hasSavedVariants, onChange, onSave, onRemove, saving }) {
  const paramDef = VARIANT_PARAM_DEFS[form.variantParam] || VARIANT_PARAM_DEFS.grades;
  const positiveLabel = paramDef.higherIsBetter ? '≥ umbral' : '≤ umbral';
  const negativeLabel = paramDef.higherIsBetter ? '< umbral' : '> umbral';
  return (
    <Card className="platform-card p-4" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
      <div>
        <p className="eyebrow">Variante por parámetro — {trigger.label}</p>
        <p className="panel-description" style={{ margin: '0.25rem 0 0' }}>
          Opcional: si configuras esto, al llegar a este disparador el plugin calcula el parámetro
          elegido para ese alumno y elige una de estas 2 plantillas en vez de la plantilla única de
          arriba.
        </p>
      </div>
      <div className="grid gap-1.5" style={{ maxWidth: 480, width: '100%' }}>
        <Label>Parámetro que decide la variante</Label>
        <Select
          value={form.variantParam}
          onValueChange={(value) => {
            const nextDef = VARIANT_PARAM_DEFS[value];
            // El valor numérico no tiene sentido igual al cambiar de
            // unidad (ej. "50" como % de calificaciones vs. "50" días de
            // inactividad, visto en QA) — se resetea a un default propio
            // de cada parámetro en vez de arrastrar el anterior.
            const defaultThreshold = nextDef?.unit === 'días' ? '30' : '50';
            onChange({ ...form, variantParam: value, threshold: defaultThreshold });
          }}
        >
          <SelectTrigger>
            <SelectValue className="whitespace-normal" />
          </SelectTrigger>
          <SelectContent>
            {trigger.variantParams.map((key) => (
              <SelectItem key={key} value={key}>
                {VARIANT_PARAM_DEFS[key]?.label || key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* Una columna, no dos — los nombres de plantilla (shortname + idioma)
          se cortaban con dos columnas lado a lado (visto en QA). */}
      <div className="grid gap-3.5">
        <div className="grid gap-1.5">
          <Label>Plantilla "positiva" ({positiveLabel})</Label>
          <Select
            value={form.positiveTemplateId}
            onValueChange={(value) => onChange({ ...form, positiveTemplateId: value })}
            disabled={!templates.length}
          >
            <SelectTrigger>
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
        </div>
        <div className="grid gap-1.5">
          <Label>Plantilla "negativa" ({negativeLabel})</Label>
          <Select
            value={form.negativeTemplateId}
            onValueChange={(value) => onChange({ ...form, negativeTemplateId: value })}
            disabled={!templates.length}
          >
            <SelectTrigger>
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
        </div>
      </div>
      <div className="grid gap-1.5" style={{ maxWidth: 260 }}>
        <Label>Umbral ({paramDef.unit})</Label>
        <Input
          type="number"
          min="0"
          max="365"
          value={form.threshold}
          onChange={(e) => onChange({ ...form, threshold: e.target.value })}
        />
      </div>
      <div className="flex gap-2.5">
        <Button type="button" variant="outline" size="sm" disabled={saving || !templates.length} onClick={onSave}>
          Guardar variantes
        </Button>
        {hasSavedVariants && (
          <Button type="button" variant="destructive" size="sm" disabled={saving} onClick={onRemove}>
            Quitar variantes (volver a plantilla única)
          </Button>
        )}
      </div>
    </Card>
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
  const [copiedId, setCopiedId] = useState(null);

  async function handleCopyKey(platformId, key) {
    try {
      await navigator.clipboard.writeText(key);
    } catch {
      // Clipboard API bloqueada (ej. contexto no seguro o permiso denegado) —
      // seleccionar el texto para que al menos Ctrl+C manual funcione.
      const el = document.getElementById(`cpn-key-${platformId}`);
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    setCopiedId(platformId);
    setTimeout(() => setCopiedId((current) => (current === platformId ? null : current)), 2000);
  }

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <p id={`cpn-key-${platform.id}`} className="history-note mono" style={{ wordBreak: 'break-all', margin: 0 }}>
                      {revealedKey.key}
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleCopyKey(platform.id, revealedKey.key)}>
                      {copiedId === platform.id ? 'Copiada ✓' : 'Copiar'}
                    </Button>
                  </div>
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

// Combobox propio (texto libre + desplegable de sugerencias) porque el
// <datalist> nativo del navegador NO muestra una opción cuando coincide
// exactamente con el valor ya escrito en el campo — con un único valor
// candidato (el caso normal aquí: casi todas las plataformas comparten el
// mismo nombre de campo personalizado) el desplegable nativo se queda
// vacío al abrirlo, aunque la sugerencia exista. Este siempre la muestra.
function ComboboxInput({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter((o) => o.toLowerCase().includes((value || '').toLowerCase()));

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <Input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div
          className="rounded-control border border-border-soft bg-surface-muted shadow-lg"
          style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4, maxHeight: 200, overflowY: 'auto' }}
        >
          {filtered.map((option) => (
            <button
              key={option}
              type="button"
              className="mono"
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
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
  const [categories, setCategories] = useState([]);
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
    Promise.all([
      getNotificationPlatformSettings(platformId),
      getNotificationPlatformCourses(platformId),
      getNotificationPlatformCategories(platformId),
    ])
      .then(([settingsData, coursesData, categoriesData]) => {
        setSettings(settingsData);
        setCourses(coursesData);
        setCategories(categoriesData);
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

  function toggleEnabledCategory(categoryId) {
    setSettings((prev) => {
      const ids = new Set(prev.enabledCategoryIds || []);
      if (ids.has(categoryId)) ids.delete(categoryId);
      else ids.add(categoryId);
      return { ...prev, enabledCategoryIds: Array.from(ids) };
    });
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      const saved = await updateNotificationPlatformSettings(platformId, {
        courseCustomFieldShortname: settings.courseCustomFieldShortname,
        diplomaOnlyCourseIds: settings.diplomaOnlyCourseIds || [],
        enabledCategoryIds: settings.enabledCategoryIds || [],
      });
      setSettings(saved);
      flash('Ajustes guardados.');
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  // El interruptor maestro se guarda al instante, aparte del resto del
  // formulario — es un control de seguridad, no debería depender de que
  // alguien recuerde pulsar "Guardar ajustes" después de tocarlo.
  async function handleToggleNotifications(nextValue) {
    setSettings((prev) => ({ ...prev, notificationsEnabled: nextValue }));
    try {
      const saved = await updateNotificationPlatformSettings(platformId, { notificationsEnabled: nextValue });
      setSettings(saved);
      flash(nextValue ? 'Notificaciones activadas para esta plataforma.' : 'Notificaciones desactivadas para esta plataforma.');
    } catch (err) {
      setSettings((prev) => ({ ...prev, notificationsEnabled: !nextValue }));
      flash(err.message, 'error');
    }
  }

  if (loadingPlatforms) return <p className="empty">Cargando plataformas…</p>;
  if (!platforms.length) return <p className="empty">No hay plataformas configuradas todavía.</p>;

  const filteredCourses = courseFilter
    ? courses.filter((c) => c.courseName.toLowerCase().includes(courseFilter.toLowerCase()))
    : courses;
  const diplomaOnlyIds = new Set(settings?.diplomaOnlyCourseIds || []);
  const enabledCategoryIds = new Set(settings?.enabledCategoryIds || []);

  return (
    <div className="section-stack">
      <p className="panel-description">
        Parámetros propios de cada plataforma (no de un disparador en concreto): el campo
        personalizado de Moodle que activa notificaciones por curso, y qué cursos son "solo
        diploma" (reciben únicamente el email de diploma disponible, sin progreso ni
        recordatorios de fin de curso).
      </p>

      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3.5 max-[720px]:grid-cols-1">
          <div className="grid gap-1.5">
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

          {settings && (
            <div className="grid gap-1.5">
              <Label>Campo personalizado que activa notificaciones por curso</Label>
              <ComboboxInput
                value={settings.courseCustomFieldShortname || ''}
                onChange={(value) => setSettings({ ...settings, courseCustomFieldShortname: value })}
                options={customFieldOptions}
              />
            </div>
          )}
        </div>
        {settings && (
          <p className="history-note" style={{ marginTop: '0.75rem' }}>
            Campo personalizado: escribe el valor o elígelo de la lista (valores ya usados en otras
            plataformas). Debe coincidir con el "Nombre corto" del campo personalizado (tipo
            casilla de verificación) creado en esta plataforma bajo Administración del sitio →
            Cursos → Campos personalizados del curso.
          </p>
        )}
      </Card>

      {loadingDetail || !settings ? (
        <p className="empty">Cargando ajustes…</p>
      ) : (
        <>
          <Card
            className="p-4"
            style={{ borderColor: settings.notificationsEnabled ? 'var(--color-danger)' : undefined }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <p className="eyebrow">Interruptor maestro</p>
                <h3 className="card-title">
                  {settings.notificationsEnabled ? 'Notificaciones ACTIVAS en esta plataforma' : 'Notificaciones desactivadas en esta plataforma'}
                </h3>
                <p className="history-note" style={{ marginTop: '0.35rem' }}>
                  {settings.notificationsEnabled
                    ? 'El plugin de esta plataforma puede enviar emails reales ahora mismo, para cualquier curso con el campo personalizado activado.'
                    : 'Aunque el plugin esté conectado (API key pegada) y haya cursos con el campo personalizado activado, no se enviará ningún email hasta que actives esto — es seguro conectar la plataforma con esto apagado.'}
                </p>
              </div>
              <Switch checked={Boolean(settings.notificationsEnabled)} onCheckedChange={handleToggleNotifications} />
            </div>
          </Card>

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

          <Card className="p-4">
            <div className="panel-header panel-header-compact">
              <div>
                <p className="eyebrow">Categorías habilitadas</p>
                <h3 className="card-title">
                  {enabledCategoryIds.size
                    ? `${enabledCategoryIds.size} categoría${enabledCategoryIds.size === 1 ? '' : 's'} seleccionada${enabledCategoryIds.size === 1 ? '' : 's'}`
                    : 'Todas las categorías (sin restricción)'}
                </h3>
              </div>
            </div>
            <p className="panel-description" style={{ margin: '0 0 0.75rem' }}>
              Si no marcas ninguna, se notifican los cursos de cualquier categoría. Marcando una o
              más, solo se envían notificaciones para cursos de esas categorías — útil cuando varios
              instructores comparten plataforma y no todos quieren tener las notificaciones activas
              para sus propios cursos.
            </p>
            {!categories.length ? (
              <p className="empty">
                Esta plataforma todavía no tiene categorías sincronizadas (ver "Cursos y Alumnos").
              </p>
            ) : (
              <div style={{ maxHeight: 240, overflowY: 'auto', display: 'grid', gap: '0.4rem' }}>
                {categories.map((category) => (
                  <label
                    key={category.categoryId}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.875rem', cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={enabledCategoryIds.has(category.categoryId)}
                      onChange={() => toggleEnabledCategory(category.categoryId)}
                    />
                    {category.categoryName}
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
