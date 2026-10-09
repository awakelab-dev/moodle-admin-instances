import { Module } from '@nestjs/common';
import { SecurityService } from './security.service';
import { SecurityController } from './security.controller';
import { SecurityPluginController } from './security-plugin.controller';
import { SecurityApiKeyGuard } from './guards/security-api-key.guard';

@Module({
  controllers: [SecurityController, SecurityPluginController],
  providers: [SecurityService, SecurityApiKeyGuard],
})
export class SecurityModule {}
