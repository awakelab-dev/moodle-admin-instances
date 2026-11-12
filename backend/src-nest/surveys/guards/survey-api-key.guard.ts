import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

// Guard exclusivo de los endpoints que llama el plugin local_insightssurveys
// (no un admin logueado, sino el cron de una plataforma Moodle en
// concreto). Mismo patrón que PlatformApiKeyGuard (notificaciones) y
// SecurityApiKeyGuard, pero con su propia columna (surveysApiKeyHash) — cada
// plugin tiene su propia key, revocable sin afectar a los demás.
@Injectable()
export class SurveyApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization: string = request.headers['authorization'] || '';
    const apiKey = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';

    const dotIndex = apiKey.indexOf('.');
    const platformId = dotIndex > 0 ? apiKey.slice(0, dotIndex) : '';
    if (!platformId) {
      throw new UnauthorizedException('API key de encuestas inválida.');
    }

    const platform = await this.prisma.platform.findUnique({ where: { id: platformId } });
    if (!platform?.surveysApiKeyHash) {
      throw new UnauthorizedException('Plataforma no encontrada o sin encuestas configuradas.');
    }

    const valid = await bcrypt.compare(apiKey, platform.surveysApiKeyHash);
    if (!valid) {
      throw new UnauthorizedException('API key de encuestas inválida.');
    }

    request.platform = platform;
    return true;
  }
}
