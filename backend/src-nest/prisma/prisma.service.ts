import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Envuelve el PrismaClient generado como un provider de Nest, conectando a
// Postgres al iniciar el módulo y desconectando limpiamente al destruirlo,
// para que el resto de servicios solo tengan que inyectar PrismaService.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
