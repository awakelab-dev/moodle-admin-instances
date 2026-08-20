import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Módulo global (@Global): al registrarse una vez en AppModule, PrismaService
// queda disponible para inyectar en cualquier otro módulo sin tener que
// importar PrismaModule explícitamente en cada uno.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
