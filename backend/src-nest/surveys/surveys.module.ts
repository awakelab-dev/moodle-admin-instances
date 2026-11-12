import { Module } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { SurveysController } from './surveys.controller';
import { SurveysPluginController } from './surveys-plugin.controller';
import { SurveyApiKeyGuard } from './guards/survey-api-key.guard';

@Module({
  controllers: [SurveysController, SurveysPluginController],
  providers: [SurveysService, SurveyApiKeyGuard],
})
export class SurveysModule {}
