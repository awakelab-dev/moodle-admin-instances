import { Module } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { SurveysController } from './surveys.controller';
import { SurveysPluginController } from './surveys-plugin.controller';
import { PlatformApiKeyGuard } from '../notifications/guards/platform-api-key.guard';

@Module({
  controllers: [SurveysController, SurveysPluginController],
  providers: [SurveysService, PlatformApiKeyGuard],
})
export class SurveysModule {}
