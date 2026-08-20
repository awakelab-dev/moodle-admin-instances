import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PlatformsModule } from './platforms/platforms.module';
import { SyncModule } from './sync/sync.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AppController } from './app.controller';

// Módulo raíz: importa todos los módulos de dominio (auth, plataformas,
// sincronización, dashboard) y registra AuthGuard/RolesGuard como guards
// globales (APP_GUARD), por lo que se aplican a toda ruta salvo que se
// marque explícitamente @Public() (ver common/decorators/public.decorator).
// El orden importa: AuthGuard corre antes que RolesGuard porque este último
// necesita que request.user ya esté poblado.
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, PlatformsModule, SyncModule, DashboardModule],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
