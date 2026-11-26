import { IsObject } from 'class-validator';

// Qué disparadores concretos se envían (o no) para UN curso de una
// plataforma — ver NotificationsService.setCourseTriggerOverrides. Se valida
// a mano contra NOTIFICATION_TRIGGER_KEYS en el servicio, no aquí, porque
// las claves son dinámicas (una por disparador).
export class CourseTriggerOverridesDto {
  @IsObject()
  triggers: Record<string, boolean>;
}
