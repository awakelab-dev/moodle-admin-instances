import { useState, useEffect, useRef } from 'react';
import { triggerSync, getSyncStatus, getLastSync } from '../api';

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

  const statusClass = syncing
    ? 'status-chip-running'
    : error || progress?.status === 'failed'
      ? 'status-chip-error'
      : progress?.status === 'completed'
        ? 'status-chip-success'
        : 'status-chip-idle';

  return (
    <div className="sync-panel card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Proceso</p>
          <h2 className="card-title">Panel de sincronización</h2>
          <p className="panel-description">
            Ejecuta la actualización general y controla el avance de cada plataforma
            desde un bloque principal de acción.
          </p>
        </div>
        <span className={`status-chip ${statusClass}`}>{statusText}</span>
      </div>

      <div className="sync-action-row">
        <button className="sync-btn" onClick={handleSync} disabled={syncing}>
          {syncing && <span className="spinner" />}
          {syncing ? 'Sincronizando…' : 'Actualizar datos'}
        </button>
        <div className="sync-meta-card">
          <span className="sync-meta-label">Última actualización</span>
          <strong className="sync-meta-value">{formatLastSync(lastSync)}</strong>
        </div>
        <div className="sync-meta-card">
          <span className="sync-meta-label">{timerLabel}</span>
          <strong className="sync-meta-value">{timerValue}</strong>
        </div>
      </div>

      {syncing && progress && (
        <div className="progress-area">
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="progress-text">
            {activeCount > 0
              ? `Activas ahora (${activeCount}${maxParallel ? `/${maxParallel}` : ''}): ${activePlatforms.join(', ')}`
              : progress.current_platform
                ? `Procesando: ${progress.current_platform}`
                : 'Iniciando…'}{' '}
            — completadas {progress.platforms_synced}/{progress.platforms_total} plataformas
          </p>
          <p className="progress-text">
            {maxParallel > 0
              ? `Concurrencia máxima: ${maxParallel}. En espera: ${queuedCount}`
              : 'Preparando cola de sincronización…'}
          </p>
          <p className="progress-text">
            Tiempo transcurrido: <strong>{formatDuration(currentDurationMs)}</strong>
          </p>
        </div>
      )}

      {!syncing && progress && progress.status === 'completed' && (
        <div className="status-banner status-banner-success">
          Sincronización completada correctamente
          {completionDurationText ? ` en ${completionDurationText}.` : '.'}
        </div>
      )}

      {!syncing && progress && progress.status === 'failed' && (
        <div className="status-banner status-banner-error">
          La sincronización finalizó con errores
          {completionDurationText ? ` tras ${completionDurationText}.` : '.'}
        </div>
      )}

      {progressErrors.length > 0 && (
        <ul className="error-list">
          {progressErrors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      {error && <div className="status-banner status-banner-error">{error}</div>}
    </div>
  );
}
