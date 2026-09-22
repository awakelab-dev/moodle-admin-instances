import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { UpsertRuleDto } from './dto/upsert-rule.dto';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { Roles } from '../common/decorators/roles.decorator';

// Panel de administración ("Gestión de Notificaciones" en el frontend) —
// solo superadmin, igual que Usuarios/Configuración. Ver
// notifications-plugin.controller.ts para las rutas que llama el plugin.
@Controller('notifications')
@Roles('admin')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get('triggers')
  listTriggers() {
    return this.notifications.listTriggers();
  }

  @Get('templates')
  listTemplates() {
    return this.notifications.listTemplates();
  }

  @Post('templates')
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.notifications.createTemplate(dto);
  }

  @Put('templates/:id')
  updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.notifications.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id') id: string) {
    return this.notifications.deleteTemplate(id);
  }

  @Get('rules')
  listRules(@Query('platformId') platformId?: string) {
    return this.notifications.listRules(platformId);
  }

  @Post('rules')
  upsertRule(@Body() dto: UpsertRuleDto) {
    return this.notifications.upsertRule(dto);
  }

  @Delete('rules/:id')
  deleteRule(@Param('id') id: string) {
    return this.notifications.deleteRule(id);
  }

  @Get('delivery-log')
  listDeliveryLog(
    @Query('platformId') platformId?: string,
    @Query('trigger') trigger?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.listDeliveryLog({
      platformId,
      trigger,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('platforms/:platformId/api-key')
  generateApiKey(@Param('platformId') platformId: string) {
    return this.notifications.generateApiKey(platformId);
  }

  @Delete('platforms/:platformId/api-key')
  revokeApiKey(@Param('platformId') platformId: string) {
    return this.notifications.revokeApiKey(platformId);
  }

  @Get('custom-field-shortnames')
  listKnownCustomFieldShortnames() {
    return this.notifications.listKnownCustomFieldShortnames();
  }

  @Get('platforms/:platformId/settings')
  getPlatformSettings(@Param('platformId') platformId: string) {
    return this.notifications.getPlatformSettings(platformId);
  }

  @Put('platforms/:platformId/settings')
  updatePlatformSettings(@Param('platformId') platformId: string, @Body() dto: UpdatePlatformSettingsDto) {
    return this.notifications.updatePlatformSettings(platformId, dto);
  }

  @Get('platforms/:platformId/courses')
  listPlatformCourses(@Param('platformId') platformId: string) {
    return this.notifications.listPlatformCourses(platformId);
  }
}
