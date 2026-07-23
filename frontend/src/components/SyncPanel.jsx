import { useState, useEffect, useRef } from 'react';
import { triggerSync, getSyncStatus, getLastSync } from '../api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

function formatLastSync(lastSync) {
  if (!lastSync?.completed_at) return 'Sin registros aún';
  return new Date(lastSync.completed_at).toLocaleString('es-CL');
}

function getDurationMs(startedAt, completedAt = null, nowMs = Date.now()) {
  if (!startedAt) return null;
  const startMs = new Date(startedAt).getTime();
  const endMs = completedAt ? new Date(completedAt).getTime() : nowMs;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Math.max(0, endMs - startMs);
}

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs)) return '—';

  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
  }
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

export default function SyncPanel({ onSyncComplete }) {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const pollRef = useRef(null);

  // Fetch last sync on mount
  useEffect(() => {
    getLastSync()
      .then((data) => setLastSync(data))
      .catch(() => {});
  }, []);

  // Poll progress while syncing
  useEffect(() => {
    if (!syncing) return;

    pollRef.current = setInterval(async () => {
      try {
        const status = await getSyncStatus();
        setProgress(status);

        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(pollRef.current);
          setSyncing(false);
          // Refresh last sync
          const last = await getLastSync();
          setLastSync(last);
          // Notify parent to refresh data
          onSyncComplete?.();
        }
      } catch {
        // ignore poll errors
      }
    }, 1500);

    return () => clearInterval(pollRef.current);
  }, [syncing]);

  useEffect(() => {
    if (!(syncing || progress?.status === 'running')) return undefined;

    const tickRef = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(tickRef);
  }, [syncing, progress?.status]);

  async function handleSync() {
    setError(null);
    setSyncing(true);
    setProgress({
      status: 'running',
      started_at: new Date().toISOString(),
      completed_at: null,
      platforms_synced: 0,
      platforms_total: 0,
      sync_errors: [],
    });

    try {
      const response = await triggerSync();
      if (response?.progress) {
        setProgress((current) => ({
          ...current,
          ...response.progress,
        }));
      }
    } catch (err) {
      setError(err.message);
      setSyncing(false);
    }
  }

  const pct =
    progress && progress.platforms_total > 0
      ? Math.round((progress.platforms_synced / progress.platforms_total) * 100)
      : 0;
  const activePlatforms = progress?.active_platforms ?? [];
  const activeCount = activePlatforms.length;
  const maxParallel = progress?.platform_concurrency ?? 0;
  const queuedCount = progress
    ? Math.max(
        (progress.platforms_total || 0) - (progress.platforms_synced || 0) - activeCount,
        0
      )
    : 0;
  const progressErrors = progress?.sync_errors ?? progress?.errors ?? [];
  const currentDurationMs = getDurationMs(
    progress?.started_at,
    syncing ? null : progress?.completed_at,
    nowMs
  );
  const lastCompletedDurationMs = getDurationMs(
    lastSync?.started_at,
    lastSync?.completed_at
  );
  const timerLabel = syncing
    ? 'Tiempo transcurrido'
    : progress?.status === 'failed' && progress?.started_at
      ? 'Duración del intento'
      : 'Duración última sync';
  const timerValue = syncing
    ? formatDuration(currentDurationMs)
    : progress?.status === 'failed' && progress?.started_at
      ? formatDuration(currentDurationMs)
      : formatDuration(lastCompletedDurationMs);
  const completionDurationText =
    progress?.started_at && progress?.completed_at
      ? formatDuration(getDurationMs(progress.started_at, progress.completed_at))
      : null;

  const statusText = syncing
    ? 'Sincronizando'
    : error || progress?.status === 'failed'
      ? 'Atención requerida'
      : progress?.status === 'completed'
        ? 'Sincronización exitosa'
        : 'Listo para sincronizar';

  const statusVariant = syncing
    ? 'default'
    : error || progress?.status === 'failed'
      ? 'destructive'
      : progress?.status === 'completed'
        ? 'success'
        : 'secondary';

  return (
    <Card className="mx-auto max-w-[860px] p-4">
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.63rem] font-bold uppercase tracking-[0.1em] text-accent">Proceso</p>
          <h2 className="mt-0.5 text-lg font-bold text-white">Panel de sincronización</h2>
          <p className="mt-1 max-w-[760px] text-sm text-muted-foreground">
            Ejecuta la actualización general y controla el avance de cada plataforma
            desde un bloque principal de acción.
          </p>
        </div>
        <Badge variant={statusVariant} className="whitespace-nowrap">{statusText}</Badge>
      </div>

      <div className="mb-3 flex flex-wrap items-stretch gap-3">
        <Button onClick={handleSync} disabled={syncing}>
          {syncing && <span className="spinner" />}
          {syncing ? 'Sincronizando…' : 'Actualizar datos'}
        </Button>
        <div className="flex flex-1 min-w-[220px] flex-col justify-center gap-1 rounded-card border border-border-soft bg-surface-muted px-3.5 py-3">
          <span className="text-[0.67rem] font-bold uppercase tracking-[0.08em] text-brand-strong">Última actualización</span>
          <strong className="text-sm text-white">{formatLastSync(lastSync)}</strong>
        </div>
        <div className="flex flex-1 min-w-[220px] flex-col justify-center gap-1 rounded-card border border-border-soft bg-surface-muted px-3.5 py-3">
          <span className="text-[0.67rem] font-bold uppercase tracking-[0.08em] text-brand-strong">{timerLabel}</span>
          <strong className="text-sm text-white">{timerValue}</strong>
        </div>
      </div>

      {syncing && progress && (
        <div className="mt-3 rounded-card border border-border-soft bg-surface-muted p-3.5">
          <Progress value={pct} className="my-2.5" />
          <p className="text-sm text-brand-strong">
            {activeCount > 0
              ? `Activas ahora (${activeCount}${maxParallel ? `/${maxParallel}` : ''}): ${activePlatforms.join(', ')}`
              : progress.current_platform
                ? `Procesando: ${progress.current_platform}`
                : 'Iniciando…'}{' '}
            — completadas {progress.platforms_synced}/{progress.platforms_total} plataformas
          </p>
          <p className="text-sm text-brand-strong">
            {maxParallel > 0
              ? `Concurrencia máxima: ${maxParallel}. En espera: ${queuedCount}`
              : 'Preparando cola de sincronización…'}
          </p>
          <p className="text-sm text-brand-strong">
            Tiempo transcurrido: <strong>{formatDuration(currentDurationMs)}</strong>
          </p>
        </div>
      )}

      {!syncing && progress && progress.status === 'completed' && (
        <Alert variant="success" className="mt-3">
          <AlertDescription>
            Sincronización completada correctamente
            {completionDurationText ? ` en ${completionDurationText}.` : '.'}
          </AlertDescription>
        </Alert>
      )}

      {!syncing && progress && progress.status === 'failed' && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>
            La sincronización finalizó con errores
            {completionDurationText ? ` tras ${completionDurationText}.` : '.'}
          </AlertDescription>
        </Alert>
      )}

      {progressErrors.length > 0 && (
        <ul className="mt-3 grid gap-1.5 text-sm">
          {progressErrors.map((e, i) => (
            <li key={i} className="rounded-control border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive">
              {e}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </Card>
  );
}
