import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { SecurityService } from './security.service';
import { Roles } from '../common/decorators/roles.decorator';

// Panel "Seguridad" (Moodle Insights, solo superadmin) — ver
// security-plugin.controller.ts para las rutas que llama el plugin
// report_accessaudit.
@Controller('security')
@Roles('admin')
export class SecurityController {
  constructor(private security: SecurityService) {}

  @Get('patterns')
  listPatterns(@Query('platformId') platformId?: string, @Query('riskLevel') riskLevel?: string) {
    return this.security.listPatterns({ platformId, riskLevel });
  }

  @Post('platforms/:platformId/api-key')
  generateApiKey(@Param('platformId') platformId: string) {
    return this.security.generateApiKey(platformId);
  }

  @Delete('platforms/:platformId/api-key')
  revokeApiKey(@Param('platformId') platformId: string) {
    return this.security.revokeApiKey(platformId);
  }
}
