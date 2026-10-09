import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SecurityService } from './security.service';
import { ReportPatternsDto } from './dto/report-patterns.dto';
import { Public } from '../common/decorators/public.decorator';
import { SecurityApiKeyGuard } from './guards/security-api-key.guard';
import { CurrentPlatform } from '../notifications/current-platform.decorator';

// Ruta que llama el plugin report_accessaudit desde cada plataforma Moodle
// (su tarea programada nocturna), no un admin logueado — @Public() la saca
// del AuthGuard de sesión normal, SecurityApiKeyGuard hace su propia
// autenticación (API key "<platformId>.<secreto>").
@Controller('security/plugin')
@Public()
@UseGuards(SecurityApiKeyGuard)
export class SecurityPluginController {
  constructor(private security: SecurityService) {}

  @Post('patterns')
  reportPatterns(@CurrentPlatform() platform: { id: string }, @Body() dto: ReportPatternsDto) {
    return this.security.replacePatternsForPlatform(platform.id, dto);
  }
}
