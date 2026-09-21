import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsPluginController } from './notifications-plugin.controller';
import { PlatformApiKeyGuard } from './guards/platform-api-key.guard';

@Module({
  controllers: [NotificationsController, NotificationsPluginController],
  providers: [NotificationsService, PlatformApiKeyGuard],
})
export class NotificationsModule {}
