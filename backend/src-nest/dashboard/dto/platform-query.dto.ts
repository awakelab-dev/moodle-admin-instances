import { IsOptional, IsString } from 'class-validator';

// Query params comunes a los endpoints del dashboard que pueden filtrarse
// por plataforma; moodleSource es opcional porque varios endpoints también
// aceptan agregar datos de todas las plataformas a la vez.
export class PlatformQueryDto {
  @IsOptional()
  @IsString()
  moodleSource?: string;
}
