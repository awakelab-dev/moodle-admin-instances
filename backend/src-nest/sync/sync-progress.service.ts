import { Injectable } from '@nestjs/common';

/** Estado de una sincronización en curso (o de la última finalizada). */
export interface SyncProgress {
  id: string;
  status: 'running' | 'completed' | 'failed';
  started_at: Date;
  completed_at: Date | null;
  platforms_total: number;
  platforms_synced: number;
  current_platform: string;
  sync_errors: string[];
  current_step?: string;
  items_done?: number;
  items_total?: number;
  platform_id?: string;
}

/**
 * Guarda en memoria (no en BD) el progreso de la sincronización que esté
 * corriendo, para que el frontend pueda pedirlo por polling (GET /sync/status)
 * y para poder pedir la cancelación de una sincronización en curso desde otra
 * petición HTTP. Al vivir solo en memoria del proceso, el progreso se pierde
 * si el backend se reinicia.
 */
@Injectable()
export class SyncProgressService {
  private current: SyncProgress | null = null;
  private cancelRequested = false;

  get(): SyncProgress | null {
    return this.current;
  }

  set(progress: SyncProgress | null) {
    this.current = progress;
    // Nueva sincronización: cualquier cancelación pendiente de una corrida
    // anterior queda invalidada.
    this.cancelRequested = false;
  }

  isRunning(): boolean {
    return this.current?.status === 'running';
  }

  requestCancel() {
    this.cancelRequested = true;
  }

  isCancelRequested(): boolean {
    return this.cancelRequested;
  }
}
