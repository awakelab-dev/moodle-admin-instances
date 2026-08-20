import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../auth/auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// Guard global (registrado en AppModule vía APP_GUARD): exige un token
// válido en el header Authorization para cualquier ruta que no esté
// marcada con @Public(). Deja el usuario autenticado en request.user para
// que @CurrentUser() y el resto del handler puedan usarlo.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // getAllAndOverride revisa tanto el metadato del método como el de la
    // clase, así una ruta puede marcarse @Public() aunque el controller no
    // lo esté (o viceversa).
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authorization: string = request.headers['authorization'] || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';

    const user = await this.authService.parseAuthToken(token);
    if (!user) {
      throw new UnauthorizedException('Debes iniciar sesión.');
    }

    request.user = user;
    return true;
  }
}
