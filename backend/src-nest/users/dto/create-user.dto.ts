import { ArrayUnique, IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

// Datos para crear un usuario nuevo del dashboard (solo superadmin). Si
// role es "limited", platformIds define qué plataformas puede ver en
// Moodle Insights; para "admin" se ignora (los admin ven todas).
export class CreateUserDto {
  @IsString()
  @MinLength(1)
  username: string;

  @IsString()
  @MinLength(1)
  displayName: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password: string;

  @IsIn(['admin', 'limited'])
  role: 'admin' | 'limited';

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  platformIds?: string[];
}
