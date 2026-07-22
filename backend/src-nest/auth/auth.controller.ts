import { Body, Controller, Get, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { PublicUser } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

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

  @Get('me')
  async me(@CurrentUser() user: PublicUser) {
    return user;
  }
}
