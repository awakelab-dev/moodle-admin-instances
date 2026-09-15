import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// Gestión de usuarios del dashboard y sus permisos por plataforma. Exporta
// UsersService porque PlatformsService/DashboardService lo necesitan para
// filtrar qué plataformas puede ver un usuario "limited".
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
