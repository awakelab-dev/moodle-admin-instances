import { IsOptional, IsString } from 'class-validator';

export class PlatformQueryDto {
  @IsOptional()
  @IsString()
  moodleSource?: string;
}
