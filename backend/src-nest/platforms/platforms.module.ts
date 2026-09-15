import { Module } from '@nestjs/common';
import { PlatformsController } from './platforms.controller';
import { PlatformsService } from './platforms.service';
import { UsersModule } from '../users/users.module';

// Módulo de gestión de plataformas Moodle. Exporta PlatformsService porque
// SyncModule lo necesita para saber qué plataformas sincronizar. Importa
// UsersModule porque findAll() filtra la lista según qué plataformas puede
// ver el usuario actual (los "limited" no ven todas).
@Module({
  imports: [UsersModule],
  controllers: [PlatformsController],
  providers: [PlatformsService],
  exports: [PlatformsService],
})
export class PlatformsModule {}
