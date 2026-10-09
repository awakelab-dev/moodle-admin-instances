import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

// Igual que PlatformApiKeyGuard (notifications/guards) pero para el plugin
// report_accessaudit — API key independiente (Platform.securityApiKeyHash),
// mismo formato "<platformId>.<secreto>".
@Injectable()
export class SecurityApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization: string = request.headers['authorization'] || '';
    const apiKey = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';

    const dotIndex = apiKey.indexOf('.');
    const platformId = dotIndex > 0 ? apiKey.slice(0, dotIndex) : '';
    if (!platformId) {
      throw new UnauthorizedException('API key de seguridad inválida.');
    }

    const platform = await this.prisma.platform.findUnique({ where: { id: platformId } });
    if (!platform?.securityApiKeyHash) {
      throw new UnauthorizedException('Plataforma no encontrada o sin detector de anomalías configurado.');
    }

    const valid = await bcrypt.compare(apiKey, platform.securityApiKeyHash);
    if (!valid) {
      throw new UnauthorizedException('API key de seguridad inválida.');
    }

    request.platform = platform;
    return true;
  }
}
