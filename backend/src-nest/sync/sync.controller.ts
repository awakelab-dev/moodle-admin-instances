import { Controller, ConflictException, Get, Param, Post } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncProgressService } from './sync-progress.service';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('sync')
@Roles('admin')
export class SyncController {
  constructor(
    private syncService: SyncService,
    private progress: SyncProgressService,
    private prisma: PrismaService,
  ) {}

  @Post()
  trigger() {
    if (this.progress.isRunning()) {
      throw new ConflictException('Ya hay una sincronización en curso.');
    }
    // Fire-and-forget: same behavior as the previous Express implementation.
    this.syncService.runFullSync().catch((err) => console.error('Unhandled sync error:', err));
    return { message: 'Sincronización iniciada.' };
  }

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

  @Get('last')
  async last() {
    const log = await this.prisma.syncLog.findFirst({
      where: { status: 'completed' },
      orderBy: { completedAt: 'desc' },
    });
    if (!log) return null;

    return {
      id: log.id,
      started_at: log.startedAt,
      completed_at: log.completedAt,
      status: log.status,
      platforms_total: log.platformsTotal,
      platforms_synced: log.platformsSynced,
      current_platform: log.currentPlatform,
      sync_errors: log.syncErrors,
    };
  }
}
