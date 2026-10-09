import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ScormService } from './scorm.service';
import { Public } from '../common/decorators/public.decorator';

// Controller aparte (no hereda el @Roles('admin') de ScormController): el
// contenido de un paquete lo carga el iframe del visualizador directamente
// en el navegador, sin token de sesión — por eso es @Public(). El bucket
// S3 en sí sigue siendo privado; este endpoint es el único que lee de él
// (con las credenciales IAM del backend) y hace de proxy.
@Controller('scorm/content')
@Public()
export class ScormContentController {
  constructor(private scorm: ScormService) {}

  @Get(':id/*path')
  streamContent(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    // No se usa @Param('path') directamente: según la versión de
    // path-to-regexp el wildcard nombrado puede venir como string o como
    // array de segmentos — más fiable recortar la ruta ya resuelta de
    // req.path, que siempre es el string completo tal cual llegó.
    const prefix = `/scorm/content/${id}/`;
    const idx = req.path.indexOf(prefix);
    const relativePath = idx >= 0 ? req.path.slice(idx + prefix.length) : '';
    return this.scorm.streamContent(id, decodeURIComponent(relativePath), res);
  }
}
