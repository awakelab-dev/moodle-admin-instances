import { Module } from '@nestjs/common';
import { ScormService } from './scorm.service';
import { ScormController } from './scorm.controller';
import { ScormContentController } from './scorm-content.controller';

@Module({
  controllers: [ScormController, ScormContentController],
  providers: [ScormService],
})
export class ScormModule {}
