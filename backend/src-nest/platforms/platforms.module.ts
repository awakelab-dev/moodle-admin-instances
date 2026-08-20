import { Module } from '@nestjs/common';
import { PlatformsController } from './platforms.controller';
import { PlatformsService } from './platforms.service';

// Módulo de gestión de plataformas Moodle. Exporta PlatformsService porque
// SyncModule lo necesita para saber qué plataformas sincronizar.
@Module({
  controllers: [PlatformsController],
  providers: [PlatformsService],
  exports: [PlatformsService],
})
export class PlatformsModule {}
