import { Module } from '@nestjs/common';
import { HostingPlansService } from './hosting-plans.service';
import { HostingPlansController } from './hosting-plans.controller';

@Module({
  controllers: [HostingPlansController],
  providers: [HostingPlansService],
  exports: [HostingPlansService],
})
export class HostingPlansModule {}
