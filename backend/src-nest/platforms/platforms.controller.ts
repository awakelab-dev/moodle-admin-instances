import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { PlatformsService } from './platforms.service';
import { CreatePlatformDto } from './dto/create-platform.dto';
import { UpdatePlatformDto } from './dto/update-platform.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { PublicUser } from '../auth/auth.service';

// CRUD de plataformas Moodle configuradas más el endpoint de test de
// conexión. Enrutamiento puro: la lógica vive en PlatformsService.
// findAll() es la única ruta abierta a ambos roles (filtrada por usuario);
// el resto (alta/edición/borrado/test) es exclusivo de superadmin, porque
// es justo lo que compone la pantalla de "Configuración".
@Controller('platforms')
export class PlatformsController {
  constructor(private platformsService: PlatformsService) {}

  @Get()
  findAll(@CurrentUser() currentUser: PublicUser) {
    return this.platformsService.findAll(currentUser);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreatePlatformDto) {
    return this.platformsService.create(dto);
  }

  @Put(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdatePlatformDto) {
    return this.platformsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.platformsService.remove(id);
  }

  // Dispara el test de conexión/permisos en vivo contra el Web Service de
  // la plataforma (ver PlatformsService.testConnection).
  @Post(':id/test')
  @Roles('admin')
  test(@Param('id') id: string) {
    return this.platformsService.testConnection(id);
  }
}
