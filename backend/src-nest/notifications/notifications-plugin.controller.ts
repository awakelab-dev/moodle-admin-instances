import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ReportDeliveryDto } from './dto/report-delivery.dto';
import { Public } from '../common/decorators/public.decorator';
import { PlatformApiKeyGuard } from './guards/platform-api-key.guard';

// Rutas que llama el plugin local_courseprogressnotify desde cada
// plataforma Moodle (no un admin logueado) — @Public() las saca del
// AuthGuard de sesión normal, y PlatformApiKeyGuard hace su propia
// autenticación por plataforma + API key dedicada. Ver
// NOTIFICATIONS_INTEGRATION_PLAN.md para el contrato completo.
@Controller('notifications/plugin/:platformId')
@Public()
@UseGuards(PlatformApiKeyGuard)
export class NotificationsPluginController {
  constructor(private notifications: NotificationsService) {}

  // El plugin llama esto al principio de cada scheduled task para saber
  // qué disparadores están activos y con qué plantilla, antes de evaluar
  // condiciones (progreso, fechas) con sus propios datos locales.
  @Get('config')
  getConfig(@Param('platformId') platformId: string) {
    return this.notifications.getConfigForPlatform(platformId);
  }

  // El plugin llama esto justo después de intentar cada envío (éxito o
  // fallo), en lote, para centralizar el seguimiento en un solo lugar.
  @Post('log')
  reportDelivery(@Param('platformId') platformId: string, @Body() dto: ReportDeliveryDto) {
    return this.notifications.reportDelivery(platformId, dto);
  }
}
