import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ReportPatternsDto } from './dto/report-patterns.dto';

// Centraliza lo que antes solo se veía en el informe local de cada Moodle
// (plugin report_accessaudit — detección de cuentas compartidas/accesos
// sospechosos). El plugin sigue siendo el que analiza los logs (eso vive
// en Moodle, no aquí); este servicio solo guarda y expone el resultado.
@Injectable()
export class SecurityService {
  constructor(private prisma: PrismaService) {}

  // ─── Panel de administración ───

  async listPatterns(filters: { platformId?: string; riskLevel?: string }) {
    const patterns = await this.prisma.securitySuspiciousPattern.findMany({
      where: {
        platformId: filters.platformId || undefined,
        riskLevel: filters.riskLevel || undefined,
      },
      include: { platform: { select: { id: true, name: true } } },
      orderBy: [{ riskLevel: 'asc' }, { detectedAt: 'desc' }],
    });
    // riskLevel 'asc' alfabético deja "high" antes que "low"/"medium" por
    // casualidad del alfabeto — se reordena explícitamente para que el
    // más urgente salga primero de verdad.
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return patterns.sort((a, b) => (order[a.riskLevel] ?? 9) - (order[b.riskLevel] ?? 9));
  }

  async generateApiKey(platformId: string) {
    const platform = await this.prisma.platform.findUnique({ where: { id: platformId } });
    if (!platform) throw new NotFoundException('Plataforma no encontrada.');

    const plainKey = `${platformId}.${randomBytes(32).toString('hex')}`;
    const hash = await bcrypt.hash(plainKey, 10);
    await this.prisma.platform.update({ where: { id: platformId }, data: { securityApiKeyHash: hash } });
    return { apiKey: plainKey };
  }

  async revokeApiKey(platformId: string) {
    const platform = await this.prisma.platform.findUnique({ where: { id: platformId } });
    if (!platform) throw new NotFoundException('Plataforma no encontrada.');
    await this.prisma.platform.update({ where: { id: platformId }, data: { securityApiKeyHash: null } });
    return { message: 'API key de seguridad revocada.' };
  }

  // ─── Llamada del plugin (autenticada por SecurityApiKeyGuard) ───

  // El plugin manda SIEMPRE el snapshot completo de su análisis más
  // reciente (su tabla local se borra y recrea cada noche) — se replica
  // el mismo comportamiento aquí: fuera con lo viejo, dentro lo nuevo,
  // en una transacción para no dejar a medias si algo falla.
  async replacePatternsForPlatform(platformId: string, dto: ReportPatternsDto) {
    await this.prisma.$transaction([
      this.prisma.securitySuspiciousPattern.deleteMany({ where: { platformId } }),
      this.prisma.securitySuspiciousPattern.createMany({
        data: dto.patterns.map((p) => ({
          platformId,
          ip: p.ip,
          courseId: p.courseId,
          courseName: p.courseName,
          patternType: p.patternType,
          userIds: p.userIds as Prisma.InputJsonValue,
          usernames: p.usernames as Prisma.InputJsonValue,
          detailJson: (p.detailJson ?? {}) as Prisma.InputJsonValue,
          riskLevel: p.riskLevel,
          detectedAt: new Date(p.detectedAt),
        })),
      }),
    ]);
    return { message: `${dto.patterns.length} patrón(es) registrado(s).` };
  }
}
