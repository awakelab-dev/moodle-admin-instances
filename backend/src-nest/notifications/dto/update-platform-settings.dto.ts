import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { EMAIL_DESIGNS } from '../email-designs';

// Parámetros del plugin que son propios de la plataforma entera, no de un
// disparador concreto (por eso no viven en NotificationRule.params): qué
// campo personalizado de Moodle activa notificaciones por curso, qué
// cursos son "solo diploma" (excluidos de todos los demás disparadores), y
// el interruptor maestro de envío (ver notifications.service.ts).
export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsString()
  courseCustomFieldShortname?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  diplomaOnlyCourseIds?: number[];

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  // Lista blanca de categorías de Moodle — vacía (o no enviada) significa
  // "sin restricción, cualquier categoría es válida". Ver el comentario
  // en schema.prisma para el porqué (plataformas con varios instructores
  // que no quieren todas las categorías activas a la vez).
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  enabledCategoryIds?: number[];

  // Una de las 4 plantillas visuales fijas (ver backend/src-nest/notifications/
  // email-designs) — el usuario solo elige entre estas, nunca edita el
  // diseño en sí (eso solo lo toca el superadmin, por código).
  @IsOptional()
  @IsIn(Object.keys(EMAIL_DESIGNS))
  emailDesignKey?: string;
}
