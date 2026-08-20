import { Body, Controller, Get, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { PublicUser } from './auth.service';

// Login y consulta del usuario autenticado. El resto de rutas de la app
// están protegidas por defecto (AuthGuard global); login se marca @Public
// porque es el único punto de entrada sin sesión previa.
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Valida usuario/contraseña y devuelve el token de sesión más los datos
  // públicos del usuario. Ruta pública (no requiere estar autenticado).
  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateCredentials(dto.username, dto.password);
    if (!user) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos.');
    }
    const token = this.authService.createAuthToken(user);
    return { token, user };
  }

  // Devuelve el usuario ya autenticado (AuthGuard lo inyecta en la request
  // a partir del token); útil para que el frontend revalide la sesión.
  @Get('me')
  async me(@CurrentUser() user: PublicUser) {
    return user;
  }
}
