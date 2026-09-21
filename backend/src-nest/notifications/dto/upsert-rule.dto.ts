import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { NOTIFICATION_TRIGGER_KEYS } from '../notification-triggers.constants';

// Crea o actualiza la regla de un trigger (global si platformId es
// null/ausente, específica de una plataforma si se indica) — ver el índice
// único @@unique([trigger, platformId]) en el schema.
export class UpsertRuleDto {
  @IsIn(NOTIFICATION_TRIGGER_KEYS)
  trigger: string;

  @IsOptional()
  @IsString()
  platformId?: string | null;

  @IsString()
  templateId: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}
