import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

// Guard exclusivo de los endpoints que llama el plugin
// local_courseprogressnotify (no un admin logueado, sino el cron de una
// plataforma Moodle en concreto). Las rutas que lo usan van marcadas
// @Public() para saltarse el AuthGuard de sesión normal.
//
// La API key (header Authorization: Bearer <key>) tiene el formato
// "<platformId>.<secreto>" — el plugin no necesita configurar el
// platformId como un campo aparte (habría sido un tercer parámetro de
// conexión, además de la URL): el propio valor de la key ya lo lleva
// codificado, así el plugin solo necesita guardar dos cosas: la URL de
// Moodle Insights y esta key. Ver generateApiKey() en
// notifications.service.ts para cómo se genera.
@Injectable()
export class PlatformApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization: string = request.headers['authorization'] || '';
    const apiKey = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';

    const dotIndex = apiKey.indexOf('.');
    const platformId = dotIndex > 0 ? apiKey.slice(0, dotIndex) : '';
    if (!platformId) {
      throw new UnauthorizedException('API key de notificaciones inválida.');
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
