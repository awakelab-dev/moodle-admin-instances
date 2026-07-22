import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncProgressService } from './sync-progress.service';

@Module({
  controllers: [SyncController],
  providers: [SyncService, SyncProgressService],
  exports: [SyncProgressService, SyncService],
})
export class SyncModule {}
