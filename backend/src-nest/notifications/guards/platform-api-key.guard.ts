import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

// Guard exclusivo de los endpoints que llama el plugin
// local_courseprogressnotify (no un admin logueado, sino el cron de una
// plataforma Moodle en concreto). Las rutas que lo usan van marcadas
// @Public() para saltarse el AuthGuard de sesión normal — este guard hace
// su propia autenticación: la plataforma va en la URL (:platformId) y la
// API key dedicada (no el token de Web Service) va en el header
// Authorization, igual que un webhook.
@Injectable()
export class PlatformApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const platformId: string = request.params?.platformId;
    const authorization: string = request.headers['authorization'] || '';
    const apiKey = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';

    if (!platformId || !apiKey) {
      throw new UnauthorizedException('Falta la plataforma o la API key de notificaciones.');
    }

    const platform = await this.prisma.platform.findUnique({ where: { id: platformId } });
    if (!platform?.notificationsApiKeyHash) {
      throw new UnauthorizedException('Plataforma no encontrada o sin notificaciones configuradas.');
    }

    const valid = await bcrypt.compare(apiKey, platform.notificationsApiKeyHash);
    if (!valid) {
      throw new UnauthorizedException('API key de notificaciones inválida.');
    }

    request.platform = platform;
    return true;
  }
}
