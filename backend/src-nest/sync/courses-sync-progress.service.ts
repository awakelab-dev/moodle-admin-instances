import { Injectable } from '@nestjs/common';

/** Estado de una sincronización de "Cursos y Alumnos" en curso (o de la última finalizada). */
export interface CoursesSyncProgress {
  platformId: string;
  platformName: string;
  status: 'running' | 'completed' | 'failed';
  started_at: Date;
  completed_at: Date | null;
  current_step: string;
  items_done: number;
  items_total: number;
  sync_errors: string[];
}

/**
 * Igual que SyncProgressService pero para la sincronización dedicada de
 * "Cursos y Alumnos" (matrícula/accesos/calificaciones/foros por alumno) —
 * separada a propósito del sync de storage para que una no bloquee ni
 * pisе el progreso de la otra. Solo guarda una corrida a la vez por
 * plataforma; vive en memoria, se pierde si el backend se reinicia.
 */
@Injectable()
export class CoursesSyncProgressService {
  private byPlatform = new Map<string, CoursesSyncProgress>();

  get(platformId: string): CoursesSyncProgress | null {
    return this.byPlatform.get(platformId) || null;
  }

  set(platformId: string, progress: CoursesSyncProgress) {
    this.byPlatform.set(platformId, progress);
  }

  isRunning(platformId: string): boolean {
    return this.byPlatform.get(platformId)?.status === 'running';
  }
}
