import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Decorador de parámetro para inyectar directamente el usuario autenticado
// en el handler (@CurrentUser() user: PublicUser), leyéndolo de
// request.user, donde AuthGuard lo deja después de validar el token.
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
