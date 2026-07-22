import { IsOptional, IsString } from 'class-validator';

export class CourseBreakdownQueryDto {
  @IsString()
  moodleSource: string;

  @IsOptional()
  @IsString()
  refresh?: string;
}
