import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncProgressService } from './sync-progress.service';
import { CoursesSyncService } from './courses-sync.service';

/**
 * Agrupa todo lo relacionado con la sincronización de plataformas Moodle:
 * el controlador HTTP, el servicio que orquesta la sincronización completa
 * (storage + "Cursos y Alumnos", como una sola operación) y el servicio de
 * progreso compartido que ambas fases actualizan.
 */
@Module({
  controllers: [SyncController],
  providers: [SyncService, SyncProgressService, CoursesSyncService],
  exports: [SyncProgressService, SyncService, CoursesSyncService],
})
export class SyncModule {}
