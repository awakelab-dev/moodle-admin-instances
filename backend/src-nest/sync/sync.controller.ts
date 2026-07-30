import { Controller, ConflictException, Get, Param, Post } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncProgressService } from './sync-progress.service';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('sync')
@Roles('admin')
export class SyncController {
  constructor(
    private syncService: SyncService,
    private progress: SyncProgressService,
  ) {}

  @Post('cancel')
  cancel() {
    if (!this.progress.isRunning()) {
      throw new ConflictException('No hay ninguna sincronización en curso.');
    }
    this.progress.requestCancel();
    return { message: 'Cancelación solicitada.' };
  }

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

  @Get('status')
  status() {
    return this.progress.get() || { status: 'idle' };
  }
}
