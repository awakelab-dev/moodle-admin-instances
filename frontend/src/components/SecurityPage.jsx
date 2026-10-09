// Página "Seguridad" (Moodle Insights, exclusiva de superadmin): centraliza
// los patrones de acceso sospechoso (posibles cuentas compartidas) que
// detecta el plugin de Moodle report_accessaudit en cada plataforma
// conectada. El análisis en sí sigue corriendo cada noche DENTRO de cada
// Moodle (cron propio) — este panel solo junta y muestra el resultado;
// no hay nada que configurar aquí sobre cómo se detecta, solo qué
// plataformas están conectadas.
import { useEffect, useState } from 'react';
import {
  getSecurityPatterns,
  getPlatforms,
  generateSecurityApiKey,
  revokeSecurityApiKey,
} from '../api';
import { formatPlatformDisplayName } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import ConfirmDialog from './ConfirmDialog';

const RISK_LABELS = { high: 'Alto', medium: 'Medio', low: 'Bajo' };
const RISK_VARIANTS = { high: 'destructive', medium: 'outline', low: 'secondary' };
const PATTERN_LABELS = { sequential: 'Secuencial', simultaneous: 'Simultáneo', both: 'Secuencial + Simultáneo' };

export default function SecurityPage() {
  const [tab, setTab] = useState('patterns');
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
          <h2 className="card-title section-title">Seguridad</h2>
          <p className="panel-description">
            Patrones de acceso sospechoso (posibles cuentas compartidas) detectados por el plugin
            de auditoría en cada plataforma conectada. El análisis corre cada noche dentro de cada
            Moodle — aquí solo se centraliza el resultado.
          </p>
        </div>
      </div>

      {msg && (
        <div style={{ position: 'fixed', bottom: '1.25rem', right: '1.25rem', zIndex: 50, maxWidth: 420 }}>
          <Alert variant={msg.type === 'error' ? 'destructive' : 'success'}>
            <AlertDescription>{msg.text}</AlertDescription>
          </Alert>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Secciones de Seguridad">
          <TabsTrigger value="patterns">Patrones sospechosos</TabsTrigger>
          <TabsTrigger value="connection">Conexión</TabsTrigger>
        </TabsList>
        <TabsContent value="patterns">
          <PatternsTab flash={flash} />
        </TabsContent>
        <TabsContent value="connection">
          <SecurityConnectionTab flash={flash} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PatternsTab({ flash }) {
  const [platforms, setPlatforms] = useState([]);
  const [platformId, setPlatformId] = useState('');
  const [riskLevel, setRiskLevel] = useState('');
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlatforms()
      .then((data) => setPlatforms([...data].sort((a, b) => formatPlatformDisplayName(a.name).localeCompare(formatPlatformDisplayName(b.name)))))
      .catch((err) => flash(err.message, 'error'));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformId, riskLevel]);

  function load() {
    setLoading(true);
    getSecurityPatterns({ platformId, riskLevel })
      .then(setPatterns)
      .catch((err) => flash(err.message, 'error'))
      .finally(() => setLoading(false));
  }

  return (
    <div className="section-stack">
      <div className="grid grid-cols-2 gap-3.5 max-[560px]:grid-cols-1">
        <Select value={platformId || 'all'} onValueChange={(v) => setPlatformId(v === 'all' ? '' : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Todas las plataformas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las plataformas</SelectItem>
            {platforms.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {formatPlatformDisplayName(p.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={riskLevel || 'all'} onValueChange={(v) => setRiskLevel(v === 'all' ? '' : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Todos los niveles de riesgo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los niveles de riesgo</SelectItem>
            <SelectItem value="high">Alto</SelectItem>
            <SelectItem value="medium">Medio</SelectItem>
            <SelectItem value="low">Bajo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="empty">Cargando patrones…</p>
      ) : !patterns.length ? (
        <p className="empty">No hay patrones sospechosos registrados (con estos filtros).</p>
      ) : (
        <div className="table-wrapper insights-table-wrapper">
          <Table className="course-table">
            <TableHeader>
              <TableRow>
                <TableHead>Riesgo</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Patrón</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Alumnos implicados</TableHead>
                <TableHead>Detectado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patterns.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Badge variant={RISK_VARIANTS[p.riskLevel] || 'outline'}>{RISK_LABELS[p.riskLevel] || p.riskLevel}</Badge>
                  </TableCell>
                  <TableCell>{formatPlatformDisplayName(p.platform?.name || '')}</TableCell>
                  <TableCell>{p.courseName}</TableCell>
                  <TableCell>{PATTERN_LABELS[p.patternType] || p.patternType}</TableCell>
                  <TableCell className="mono">{p.ip}</TableCell>
                  <TableCell>{Object.values(p.usernames || {}).join(', ')}</TableCell>
                  <TableCell>{new Date(p.detectedAt).toLocaleString('es-CL')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function SecurityConnectionTab({ flash }) {
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [revealedKey, setRevealedKey] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);

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
      const { apiKey } = await generateSecurityApiKey(platform.id);
      setRevealedKey({ platformId: platform.id, key: apiKey });
      load();
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevoke() {
    const platform = revokeTarget;
    if (!platform) return;
    setRevokeTarget(null);
    setBusyId(platform.id);
    try {
      await revokeSecurityApiKey(platform.id);
      flash(`API key de seguridad revocada para "${formatPlatformDisplayName(platform.name)}".`);
      if (revealedKey?.platformId === platform.id) setRevealedKey(null);
      load();
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleCopyKey(platformId, key) {
    try {
      await navigator.clipboard.writeText(key);
    } catch {
      const el = document.getElementById(`security-key-${platformId}`);
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

  if (loading) return <p className="empty">Cargando plataformas…</p>;

  return (
    <div className="section-stack">
      <p className="panel-description">
        Cada plataforma necesita su propia API key para que el plugin{' '}
        <span className="mono">report_accessaudit</span> instalado ahí pueda reportar aquí los
        patrones sospechosos que detecte. La key solo se muestra una vez al generarla — pégala en
        Administración del sitio → Informes → Auditoría de Acceso: Moodle Insights, en esa
        plataforma, antes de cerrar esta ventana.
      </p>
      <div className="platform-list">
        {platforms.map((platform) => (
          <Card key={platform.id} className="platform-card p-4">
            <div className="platform-info">
              <div className="platform-name">{formatPlatformDisplayName(platform.name)}</div>
              <div className="platform-url">
                <Badge variant={platform.hasSecurityApiKey ? 'secondary' : 'outline'}>
                  {platform.hasSecurityApiKey ? 'Key generada' : 'Sin conectar'}
                </Badge>
              </div>
              {revealedKey?.platformId === platform.id && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <p id={`security-key-${platform.id}`} className="history-note mono" style={{ wordBreak: 'break-all', margin: 0 }}>
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
                {platform.hasSecurityApiKey ? 'Regenerar key' : 'Generar key'}
              </Button>
              {platform.hasSecurityApiKey && (
                <Button type="button" variant="destructive" disabled={busyId === platform.id} onClick={() => setRevokeTarget(platform)}>
                  Revocar
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title="Revocar API key de seguridad"
        message={
          revokeTarget
            ? `¿Revocar la key de "${formatPlatformDisplayName(revokeTarget.name)}"? El plugin dejará de poder reportar patrones sospechosos de inmediato, hasta que generes una nueva.`
            : ''
        }
        confirmLabel="Revocar"
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  );
}
