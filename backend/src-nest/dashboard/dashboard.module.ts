import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

// Módulo del dashboard: agrupa el controller y el service que exponen las
// estadísticas y reportes consumidos por el frontend.
@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
