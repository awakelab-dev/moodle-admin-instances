import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { Public } from '../common/decorators/public.decorator';
import { SurveyApiKeyGuard } from './guards/survey-api-key.guard';
import { CurrentPlatform } from '../notifications/current-platform.decorator';
import { ReportSurveyLogDto } from './dto/report-survey-log.dto';

// Rutas que llama el plugin local_insightssurveys (plugin dedicado a esto,
// separado de local_courseprogressnotify, con su PROPIA API key —
// independiente de la de "Gestión de Notificaciones", generada desde esta
// misma pantalla de Encuestas). Ver notifications-plugin.controller.ts para
// el mismo patrón.
@Controller('surveys/plugin')
@Public()
@UseGuards(SurveyApiKeyGuard)
export class SurveysPluginController {
  constructor(private surveys: SurveysService) {}

  // El plugin llama esto al principio de su tarea programada, para saber
  // qué campañas tienen un envío pendiente hoy en esta plataforma.
  @Get('campaigns')
  getDueCampaigns(@CurrentPlatform() platform: { id: string }) {
    return this.surveys.getDueCampaignsForPlatform(platform.id);
  }

  // El plugin llama esto justo después de intentar cada envío (éxito o fallo), en lote.
  @Post('log')
  reportLog(@CurrentPlatform() platform: { id: string }, @Body() dto: ReportSurveyLogDto) {
    return this.surveys.reportPluginLog(platform.id, dto.results);
  }
}
