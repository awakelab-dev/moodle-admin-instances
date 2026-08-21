import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncProgressService } from './sync-progress.service';
import { CoursesSyncService } from './courses-sync.service';
import { CoursesSyncProgressService } from './courses-sync-progress.service';

/**
 * Agrupa todo lo relacionado con la sincronización de plataformas Moodle:
 * el controlador HTTP, el servicio que ejecuta la sincronización pesada de
 * storage y su progreso, y la sincronización dedicada de "Cursos y Alumnos"
 * (matrícula/calificaciones/foros por alumno) con su propio progreso.
 */
@Module({
  controllers: [SyncController],
  providers: [SyncService, SyncProgressService, CoursesSyncService, CoursesSyncProgressService],
  exports: [SyncProgressService, SyncService, CoursesSyncService, CoursesSyncProgressService],
})
export class SyncModule {}
