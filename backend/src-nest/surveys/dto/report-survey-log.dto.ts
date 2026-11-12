import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

// Un intento de envío individual, tal como lo reporta el plugin justo
// después de intentarlo (haya salido bien o mal) — un mismo POST puede
// traer varios, ya que una tarea cron manda a muchos alumnos de una vez.
class SurveyLogResultDto {
  @IsString()
  campaignId: string;

  @IsInt()
  dayIndex: number;

  @IsString()
  recipientEmail: string;

  @IsOptional()
  @IsInt()
  moodleUserId?: number;

  @IsBoolean()
  success: boolean;

  @IsOptional()
  @IsString()
  errorMessage?: string;
}

export class ReportSurveyLogDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SurveyLogResultDto)
  results: SurveyLogResultDto[];
}
