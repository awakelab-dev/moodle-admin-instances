import { Controller, ConflictException, Get, Param, Post } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncProgressService } from './sync-progress.service';
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
}
