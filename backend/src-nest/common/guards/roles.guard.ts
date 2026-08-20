import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

// Guard global (registrado en AppModule vía APP_GUARD, después de
// AuthGuard): si la ruta tiene @Roles(...), exige que el usuario ya
// autenticado tenga uno de esos roles. Sin @Roles(), deja pasar a
// cualquier usuario autenticado.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    if (!request.user) {
      throw new UnauthorizedException('Debes iniciar sesión.');
    }
    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException('No tienes permisos para esta acción.');
    }
    return true;
  }
}
