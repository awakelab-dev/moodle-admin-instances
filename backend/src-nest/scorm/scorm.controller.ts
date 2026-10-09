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

  @Post('packages')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 * 1024 } }))
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
