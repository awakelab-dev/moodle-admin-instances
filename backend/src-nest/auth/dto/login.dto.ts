import { IsString, MinLength } from 'class-validator';

// Credenciales del body de POST /auth/login.
export class LoginDto {
  @IsString()
  @MinLength(1)
  username: string;

  @IsString()
  @MinLength(1)
  password: string;
}
