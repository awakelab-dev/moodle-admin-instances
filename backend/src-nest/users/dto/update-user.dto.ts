import { ArrayUnique, IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

// Edición parcial de un usuario existente. La contraseña solo se cambia si
// viene no vacía (igual que el token de plataforma); platformIds, cuando
// viene, reemplaza la lista completa de plataformas permitidas.
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  password?: string;

  @IsOptional()
  @IsIn(['admin', 'limited'])
  role?: 'admin' | 'limited';

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  platformIds?: string[];
}
