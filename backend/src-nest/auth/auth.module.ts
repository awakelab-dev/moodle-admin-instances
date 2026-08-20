import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// Módulo de autenticación. Exporta AuthService porque AuthGuard (en
// common/guards) lo necesita para validar el token en cada request.
@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
