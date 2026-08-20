import { IsOptional, IsString } from 'class-validator';

// Query params del endpoint de desglose de curso. moodleSource es
// obligatorio aquí (a diferencia de PlatformQueryDto) porque el desglose es
// siempre de un curso puntual dentro de una plataforma concreta. `refresh`
// llega como string (o ausente) desde la URL; se interpreta como boolean en
// DashboardService.getCourseBreakdown.
export class CourseBreakdownQueryDto {
  @IsString()
  moodleSource: string;

  @IsOptional()
  @IsString()
  refresh?: string;
}
