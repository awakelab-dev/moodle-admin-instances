import { IsBoolean, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

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
