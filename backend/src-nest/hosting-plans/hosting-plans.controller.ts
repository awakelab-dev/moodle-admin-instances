import { Controller, Get, Query } from '@nestjs/common';
import { HostingPlansService } from './hosting-plans.service';

// Catálogo de planes de hosting (BASIC/PROFESSIONAL/EXPERT) con el precio ya
// calculado del año en curso (con y sin IPC) — abierto a cualquier usuario
// autenticado (igual que GET /platforms): tanto Configuración → Plataformas
// como la tabla de Administración y config_viewer lo necesitan en lectura.
@Controller('hosting-plans')
export class HostingPlansController {
  constructor(private hostingPlans: HostingPlansService) {}

  @Get()
  list(@Query('year') year?: string) {
    return this.hostingPlans.listPlans(year ? Number(year) : undefined);
  }

  @Get('ipc-rates')
  listIpcRates() {
    return this.hostingPlans.listIpcRates();
  }
}
