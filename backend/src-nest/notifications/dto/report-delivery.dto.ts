import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { NOTIFICATION_TRIGGER_KEYS } from '../notification-triggers.constants';

// Un intento de envío individual, tal como lo reporta el plugin justo
// después de intentarlo (haya salido bien o mal) — un mismo POST puede
// traer varios, ya que una tarea cron notifica a muchos alumnos de una vez.
class DeliveryResultDto {
  @IsIn(NOTIFICATION_TRIGGER_KEYS)
  trigger: string;

  @IsInt()
  courseId: number;

  @IsInt()
  userId: number;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsBoolean()
  success: boolean;

  @IsOptional()
  @IsString()
  errorMessage?: string;
}

export class ReportDeliveryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DeliveryResultDto)
  results: DeliveryResultDto[];
}
