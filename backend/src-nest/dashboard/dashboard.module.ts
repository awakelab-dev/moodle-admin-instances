import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { UsersModule } from '../users/users.module';

// Módulo del dashboard: agrupa el controller y el service que exponen las
// estadísticas y reportes consumidos por el frontend. Importa UsersModule
// porque los endpoints de Moodle Insights filtran/validan por las
// plataformas permitidas del usuario actual (ver DashboardService).
@Module({
  imports: [UsersModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
