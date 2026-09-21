import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Igual que @CurrentUser(), pero para las rutas del plugin
// (notifications/plugin/*): PlatformApiKeyGuard deja la plataforma ya
// resuelta en request.platform tras validar la API key.
export const CurrentPlatform = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.platform;
});
