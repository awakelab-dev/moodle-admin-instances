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

  // Proveedor de hosting/administracion (ej. "DGF") — texto libre, para
  // filtrar el listado de plataformas segun va creciendo.
  @IsOptional()
  @IsString()
  provider?: string;

  // CIF/razon social del cliente final y plan de hosting contratado — ver
  // comentarios en el modelo Platform (schema.prisma). hostingPlanKey debe
  // coincidir con la "key" de un HostingPlan existente (BASIC/PROFESSIONAL/
  // EXPERT); no se valida aqui contra la lista para no acoplar el DTO a la
  // base de datos — PlatformsService.create/update deja que la FK de
  // Postgres rechace una key inexistente.
  @IsOptional()
  @IsString()
  cif?: string;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsString()
  hostingPlanKey?: string;
}
