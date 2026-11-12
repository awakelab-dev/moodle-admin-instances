import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { CreateSurveyCampaignDto } from './dto/create-survey-campaign.dto';
import { Roles } from '../common/decorators/roles.decorator';

// Panel "Encuestas" en Insights — solo superadmin, igual que Configuración.
@Controller('surveys')
@Roles('admin')
export class SurveysController {
  constructor(private surveys: SurveysService) {}

  @Get()
  list() {
    return this.surveys.list();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.surveys.getOne(id);
  }

  @Post()
  create(@Body() dto: CreateSurveyCampaignDto) {
    return this.surveys.create(dto);
  }

  @Put(':id/active')
  setActive(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.surveys.setActive(id, isActive);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.surveys.remove(id);
  }

  @Post('platforms/:platformId/api-key')
  generateApiKey(@Param('platformId') platformId: string) {
    return this.surveys.generateApiKey(platformId);
  }

  @Delete('platforms/:platformId/api-key')
  revokeApiKey(@Param('platformId') platformId: string) {
    return this.surveys.revokeApiKey(platformId);
  }
}
