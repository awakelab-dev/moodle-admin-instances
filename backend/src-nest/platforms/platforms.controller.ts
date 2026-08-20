import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { PlatformsService } from './platforms.service';
import { CreatePlatformDto } from './dto/create-platform.dto';
import { UpdatePlatformDto } from './dto/update-platform.dto';

// CRUD de plataformas Moodle configuradas más el endpoint de test de
// conexión. Enrutamiento puro: la lógica vive en PlatformsService.
@Controller('platforms')
export class PlatformsController {
  constructor(private platformsService: PlatformsService) {}

  @Get()
  findAll() {
    return this.platformsService.findAll();
  }

  @Post()
  create(@Body() dto: CreatePlatformDto) {
    return this.platformsService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePlatformDto) {
    return this.platformsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.platformsService.remove(id);
  }

  // Dispara el test de conexión/permisos en vivo contra el Web Service de
  // la plataforma (ver PlatformsService.testConnection).
  @Post(':id/test')
  test(@Param('id') id: string) {
    return this.platformsService.testConnection(id);
  }
}
