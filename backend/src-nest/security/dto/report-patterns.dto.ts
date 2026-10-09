import { IsArray, IsIn, IsInt, IsISO8601, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Forma de cada patrón tal como lo manda report_accessaudit::insights_client
// (ver analyzer::run() en el plugin) — userIds/usernames/detailJson viajan
// ya serializados a JSON desde PHP, por eso se reciben como object/array
// genérico en vez de tiparlos más estricto.
class SuspiciousPatternDto {
  @IsString()
  ip: string;

  @IsInt()
  courseId: number;

  @IsString()
  courseName: string;

  @IsIn(['sequential', 'simultaneous', 'both'])
  patternType: string;

  @IsArray()
  userIds: number[];

  @IsObject()
  usernames: Record<string, string>;

  @IsOptional()
  @IsObject()
  detailJson?: Record<string, unknown>;

  @IsIn(['low', 'medium', 'high'])
  riskLevel: string;

  @IsISO8601()
  detectedAt: string;
}

// El plugin manda SIEMPRE el snapshot completo de su análisis más
// reciente (su propia tabla local se borra y recrea cada noche) — por eso
// esto es un reemplazo total de los patrones de esa plataforma, no un
// append incremental (ver SecurityService.replacePatternsForPlatform).
export class ReportPatternsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SuspiciousPatternDto)
  patterns: SuspiciousPatternDto[];
}
