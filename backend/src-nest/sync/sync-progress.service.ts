import { Injectable } from '@nestjs/common';

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

@Injectable()
export class SyncProgressService {
  private current: SyncProgress | null = null;

  get(): SyncProgress | null {
    return this.current;
  }

  set(progress: SyncProgress | null) {
    this.current = progress;
  }

  isRunning(): boolean {
    return this.current?.status === 'running';
  }
}
