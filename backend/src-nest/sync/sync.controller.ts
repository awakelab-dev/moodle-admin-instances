import { Controller, ConflictException, Get, Param, Post } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncProgressService } from './sync-progress.service';
import { CoursesSyncService } from './courses-sync.service';
import { CoursesSyncProgressService } from './courses-sync-progress.service';
import { Roles } from '../common/decorators/roles.decorator';

/**
 * Endpoints HTTP para disparar/cancelar/consultar la sincronización de una
 * plataforma Moodle. Solo accesible para usuarios con rol admin. La lógica
 * pesada vive en SyncService; este controlador solo orquesta la petición.
 */
@Controller('sync')
@Roles('admin')
export class SyncController {
  constructor(
    private syncService: SyncService,
    private progress: SyncProgressService,
    private coursesSyncService: CoursesSyncService,
    private coursesSyncProgress: CoursesSyncProgressService,
  ) {}

  /** Marca la sincronización en curso para que se detenga en el próximo punto de chequeo. */
  @Post('cancel')
  cancel() {
    if (!this.progress.isRunning()) {
      throw new ConflictException('No hay ninguna sincronización en curso.');
    }
    this.progress.requestCancel();
    return { message: 'Cancelación solicitada.' };
  }

  /** Lanza la sincronización de una sola plataforma (por id) en segundo plano. */
  @Post(':platformId')
  triggerSingle(@Param('platformId') platformId: string) {
    if (this.progress.isRunning()) {
      throw new ConflictException('Ya hay una sincronización en curso.');
    }
    // Fire-and-forget: la sincronización sigue corriendo en el backend aunque
    // el usuario cambie de pestaña o cierre la petición.
    this.syncService
      .runSinglePlatformInBackground(platformId)
      .catch((err) => console.error('Unhandled single sync error:', err));
    return { message: 'Sincronización iniciada.' };
  }

  /** Devuelve el estado actual (o el último finalizado) de la sincronización. */
  @Get('status')
  status() {
    return this.progress.get() || { status: 'idle' };
  }

  /**
   * Lanza la sincronización dedicada de "Cursos y Alumnos" (matrícula,
   * accesos, calificaciones por ítem, finalización de actividades y
   * mensajes de foro por alumno) de una plataforma en segundo plano —
   * independiente del sync de storage de arriba.
   */
  @Post('courses/:platformId')
  triggerCoursesSync(@Param('platformId') platformId: string) {
    if (this.coursesSyncProgress.isRunning(platformId)) {
      throw new ConflictException('Ya hay una sincronización de cursos y alumnos en curso para esta plataforma.');
    }
    this.coursesSyncService
      .runInBackground(platformId)
      .catch((err) => console.error('Unhandled courses-sync error:', err));
    return { message: 'Sincronización de cursos y alumnos iniciada.' };
  }

  /** Devuelve el estado de la sincronización de "Cursos y Alumnos" de una plataforma. */
  @Get('courses/:platformId/status')
  coursesSyncStatus(@Param('platformId') platformId: string) {
    return this.coursesSyncProgress.get(platformId) || { status: 'idle' };
  }
}
