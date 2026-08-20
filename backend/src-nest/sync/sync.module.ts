import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncProgressService } from './sync-progress.service';

/**
 * Agrupa todo lo relacionado con la sincronización de plataformas Moodle:
 * el controlador HTTP, el servicio que ejecuta la sincronización pesada
 * y el servicio que guarda el progreso en memoria para poder consultarlo.
 */
@Module({
  controllers: [SyncController],
  providers: [SyncService, SyncProgressService],
  exports: [SyncProgressService, SyncService],
})
export class SyncModule {}
