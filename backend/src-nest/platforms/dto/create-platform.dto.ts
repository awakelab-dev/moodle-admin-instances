import { IsBoolean, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

// Datos requeridos para registrar una nueva plataforma Moodle: nombre, URL
// del sitio y token del Web Service. monthlyCharge/isActive son opcionales
// porque una plataforma puede darse de alta sin configuración financiera.
export class CreatePlatformDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  url: string;

  @IsString()
  @MinLength(1)
  token: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyCharge?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
