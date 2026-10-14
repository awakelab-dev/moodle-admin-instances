import { Body, Controller, Delete, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ScormService } from './scorm.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { PublicUser } from '../auth/auth.service';

// Visualizador SCORM dentro de Moodle Insights — solo superadmin puede
// subir/borrar paquetes (contenido de formación, no datos de alumnos), de
// ahí el mismo @Roles('admin') que el resto de paneles de administración.
@Controller('scorm')
@Roles('admin')
export class ScormController {
  constructor(private scorm: ScormService) {}

  @Get('packages')
  listPackages() {
    return this.scorm.listPackages();
  }

  // Límite real de producción (aviso del servidor, 13-oct-2026): nginx
  // corta en 500 MB por petición, y el ZIP se procesa entero en memoria
  // (multer memoryStorage + AdmZip, ~3x el tamaño del archivo) con pm2
  // reiniciando el backend si pasa de 2 GB de RAM. 300 MB deja margen
  // frente a ambos límites — subirlo requeriría pasar la subida a disco o
  // a streaming, no solo cambiar este número.
  @Post('packages')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 300 * 1024 * 1024 } }))
  uploadPackage(
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name: string,
    @Body('optimize') optimize: string,
    @CurrentUser() currentUser: PublicUser,
  ) {
    return this.scorm.uploadPackage(file, name, optimize === 'true', currentUser);
  }

  @Delete('packages/:id')
  deletePackage(@Param('id') id: string) {
    return this.scorm.deletePackage(id);
  }
}
