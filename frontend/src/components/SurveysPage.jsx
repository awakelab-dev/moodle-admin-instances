// Página "Encuestas" (Moodle Insights, exclusiva de superadmin): campañas
// de encuesta de calidad de curso. El link de la encuesta en sí vive fuera
// de la app (Typeform/Google Form) — aquí solo se programa cuándo y a quién
// se le manda, el día de inicio del curso y los días siguientes. El envío
// real lo hace local_insightssurveys, un plugin propio (separado del de
// notificaciones de progreso, aunque con el mismo mecanismo: email real e
// inmediato, no mensajería de Moodle) que hay que instalar en cada
// plataforma que mande encuestas, en su tarea programada diaria — con su
// propia API key (independiente de la de notificaciones), que se genera
// aquí mismo.
import { Fragment, useEffect, useState } from 'react';
import {
  getSurveyCampaigns,
  getSurveyCampaign,
  createSurveyCampaign,
  setSurveyCampaignActive,
  deleteSurveyCampaign,
  generateSurveysApiKey,
  revokeSurveysApiKey,
  getPlatforms,
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import ConfirmDialog from './ConfirmDialog';

const EMPTY_FORM = {
  name: '',
  surveyUrl: '',
  recipientSource: 'manual',
  manualRecipientsText: '',
  platformId: '',
  courseId: '',
  startDate: new Date().toISOString().slice(0, 10),
  daysCount: 5,
};

export default function SurveysPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedDetail, setExpandedDetail] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [keyBusyId, setKeyBusyId] = useState(null);
  const [revealedKey, setRevealedKey] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [campaignsData, platformsData] = await Promise.all([getSurveyCampaigns(), getPlatforms()]);
      setCampaigns(campaignsData);
      setPlatforms(platformsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        surveyUrl: form.surveyUrl,
        recipientSource: form.recipientSource,
        platformId: form.platformId || undefined,
        startDate: form.startDate,
        daysCount: Number(form.daysCount) || 5,
      };
      if (form.recipientSource === 'manual') {
        payload.manualRecipients = form.manualRecipientsText
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      } else {
        payload.courseId = Number(form.courseId);
      }
      await createSurveyCampaign(payload);
      setForm(EMPTY_FORM);
      setNotice('Campaña creada.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleExpand(id) {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(id);
    setExpandedDetail(null);
    try {
      const detail = await getSurveyCampaign(id);
      setExpandedDetail(detail);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggleActive(campaign) {
    try {
      await setSurveyCampaignActive(campaign.id, !campaign.isActive);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteSurveyCampaign(pendingDelete.id);
      setPendingDelete(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerateKey(platform) {
    setKeyBusyId(platform.id);
    setRevealedKey(null);
    try {
      const { apiKey } = await generateSurveysApiKey(platform.id);
      setRevealedKey({ platformId: platform.id, key: apiKey });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setKeyBusyId(null);
    }
  }

  async function handleRevokeKey(platform) {
    setKeyBusyId(platform.id);
    try {
      await revokeSurveysApiKey(platform.id);
      setNotice(`API key de encuestas revocada para "${formatPlatformDisplayName(platform.name)}".`);
      if (revealedKey?.platformId === platform.id) setRevealedKey(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setKeyBusyId(null);
    }
  }

  async function handleCopyKey(platformId, key) {
    try {
      await navigator.clipboard.writeText(key);
    } catch {
      const el = document.getElementById(`survey-key-${platformId}`);
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    setCopiedId(platformId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (loading) return <p className="empty">Cargando encuestas…</p>;

  return (
    <div className="section-stack">
      <h2 className="section-title">Encuestas de calidad</h2>
      <p className="panel-description">
        Programa el envío de una encuesta (link externo de Typeform/Google Form) a los alumnos de un curso, por email
        real desde la propia plataforma Moodle (vía el plugin local_insightssurveys), el día de inicio y los días
        siguientes. La plataforma elegida debe tener ya generada su propia API key de encuestas (ver abajo).
      </p>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <Card className="p-4 pt-4">
        <div className="panel-header panel-header-compact">
          <div>
            <p className="eyebrow">Conexión</p>
            <h3 className="card-title">API key del plugin local_insightssurveys</h3>
          </div>
        </div>
        <p className="panel-description">
          Cada plataforma necesita su propia API key, independiente de la de Notificaciones, para que el plugin{' '}
          <span className="mono">local_insightssurveys</span> instalado ahí pueda conectarse. La key solo se muestra
          una vez al generarla — pégala en la configuración del plugin en esa plataforma antes de cerrar esta ventana.
        </p>
        <div className="platform-list">
          {platforms.map((platform) => (
            <Card key={platform.id} className="platform-card p-3">
              <div className="platform-info">
                <div className="platform-name">{formatPlatformDisplayName(platform.name)}</div>
                <div className="platform-url">
                  <Badge variant={platform.hasSurveysApiKey ? 'secondary' : 'outline'}>
                    {platform.hasSurveysApiKey ? 'Conectada' : 'Sin conectar'}
                  </Badge>
                </div>
                {revealedKey?.platformId === platform.id && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <p id={`survey-key-${platform.id}`} className="history-note mono" style={{ wordBreak: 'break-all', margin: 0 }}>
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
                <Button type="button" variant="outline" size="sm" disabled={keyBusyId === platform.id} onClick={() => handleGenerateKey(platform)}>
                  {platform.hasSurveysApiKey ? 'Regenerar key' : 'Generar key'}
                </Button>
                {platform.hasSurveysApiKey && (
                  <Button type="button" variant="destructive" size="sm" disabled={keyBusyId === platform.id} onClick={() => handleRevokeKey(platform)}>
                    Revocar
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </Card>

      <Card className="p-4 pt-4">
        <div className="panel-header panel-header-compact">
          <div>
            <p className="eyebrow">Nueva campaña</p>
            <h3 className="card-title">Crear campaña de encuesta</h3>
          </div>
        </div>
        <form onSubmit={handleCreate} className="grid gap-3.5" noValidate>
          <div className="grid grid-cols-2 gap-3.5 max-[720px]:grid-cols-1">
            <div className="grid gap-1.5">
              <Label>Nombre de la campaña</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Piloto encuesta de calidad"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label>URL de la encuesta (Typeform/Google Form)</Label>
              <Input
                value={form.surveyUrl}
                onChange={(e) => setForm({ ...form, surveyUrl: e.target.value })}
                placeholder="https://..."
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Plataforma (debe tener ya API key de notificaciones)</Label>
              <Select value={form.platformId} onValueChange={(v) => setForm({ ...form, platformId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una plataforma" />
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
            <div className="grid gap-1.5">
              <Label>Destinatarios</Label>
              <Select
                value={form.recipientSource}
                onValueChange={(v) => setForm({ ...form, recipientSource: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Lista manual de emails (piloto/prueba)</SelectItem>
                  <SelectItem value="course_enrollment">Matrícula del curso (producción)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.recipientSource === 'manual' ? (
              <div className="grid gap-1.5 col-span-2 max-[720px]:col-span-1">
                <Label>Emails destinatarios (uno por línea o separados por coma)</Label>
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                  value={form.manualRecipientsText}
                  onChange={(e) => setForm({ ...form, manualRecipientsText: e.target.value })}
                  placeholder="alumno@ejemplo.com"
                  rows={3}
                  required
                />
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label>Course ID de Moodle</Label>
                <Input
                  type="number"
                  value={form.courseId}
                  onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                  required
                />
              </div>
            )}

            <div className="grid gap-1.5">
              <Label>Día de inicio del curso</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Días de envío (día de inicio + siguientes)</Label>
              <Input
                type="number"
                min={1}
                value={form.daysCount}
                onChange={(e) => setForm({ ...form, daysCount: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2.5">
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Crear campaña'}
            </Button>
          </div>
        </form>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Plataforma</TableHead>
            <TableHead>Destinatarios</TableHead>
            <TableHead>Inicio</TableHead>
            <TableHead>Días</TableHead>
            <TableHead>Activa</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((c) => (
            <Fragment key={c.id}>
              <TableRow className="cursor-pointer" onClick={() => toggleExpand(c.id)}>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.platform ? formatPlatformDisplayName(c.platform.name) : '—'}</TableCell>
                <TableCell>
                  {c.recipientSource === 'manual' ? `${c.manualRecipients.length} email(s)` : `Curso ${c.courseId}`}
                </TableCell>
                <TableCell>{new Date(c.startDate).toLocaleDateString('es-ES')}</TableCell>
                <TableCell>{c.daysCount}</TableCell>
                <TableCell>
                  <Badge variant={c.isActive ? 'default' : 'outline'}>{c.isActive ? 'Activa' : 'Pausada'}</Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <Switch checked={c.isActive} onCheckedChange={() => handleToggleActive(c)} />
                    <Button type="button" size="sm" variant="destructive" onClick={() => setPendingDelete(c)}>
                      Eliminar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              {expandedId === c.id && (
                <TableRow>
                  <TableCell colSpan={7}>
                    {!expandedDetail ? (
                      <p className="empty">Cargando historial…</p>
                    ) : expandedDetail.sends.length === 0 ? (
                      <p className="empty">Todavía no se ha mandado ningún correo de esta campaña.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Día</TableHead>
                            <TableHead>Destinatario</TableHead>
                            <TableHead>Resultado</TableHead>
                            <TableHead>Fecha de envío</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {expandedDetail.sends.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell>{s.dayIndex}</TableCell>
                              <TableCell>{s.recipientEmail}</TableCell>
                              <TableCell>
                                {s.success ? (
                                  <Badge>Enviado</Badge>
                                ) : (
                                  <Badge variant="destructive" title={s.errorMessage || ''}>
                                    Error
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>{new Date(s.sentAt).toLocaleString('es-ES')}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
          {campaigns.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="empty">
                No hay campañas de encuesta todavía.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Eliminar campaña"
        message={`¿Seguro que quieres eliminar la campaña "${pendingDelete?.name}"? Se borrará también su historial de envíos.`}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
