import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

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
}
