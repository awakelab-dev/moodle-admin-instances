import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { NOTIFICATION_TRIGGER_KEYS, VARIANT_PARAM_KEYS } from '../notification-triggers.constants';

// Guarda de una vez las 2 plantillas-variante (positiva/negativa) de un
// trigger que lo soporte (ver `variantParams` en notification-triggers.
// constants.ts — por ahora solo progress_50/progress_75) más qué parámetro
// se usa para elegir entre ellas y el umbral. Las 2 filas de
// NotificationRule que esto genera comparten el mismo variantParam+threshold
// a propósito (ver NotificationsService.upsertTriggerVariants) — son
// parámetros del trigger, no de una plantilla en particular.
export class UpsertTriggerVariantsDto {
  @IsIn(NOTIFICATION_TRIGGER_KEYS)
  trigger: string;

  @IsOptional()
  @IsString()
  platformId?: string | null;

  @IsIn(VARIANT_PARAM_KEYS)
  variantParam: string;

  @IsString()
  positiveTemplateId: string;

  @IsString()
  negativeTemplateId: string;

  // Para variantParam con unidad "%" (grades/attendance) es un porcentaje;
  // para "inactivity_risk" son días — por eso el rango admite hasta 365, no
  // solo 0-100 (ver VARIANT_PARAM_DEFS.unit para la UI).
  @IsInt()
  @Min(0)
  @Max(365)
  threshold: number;
}
