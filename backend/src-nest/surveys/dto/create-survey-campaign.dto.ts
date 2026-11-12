import { ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateSurveyCampaignDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  surveyUrl: string;

  @IsOptional()
  @IsString()
  messageTemplate?: string;

  @IsIn(['manual', 'course_enrollment'])
  recipientSource: 'manual' | 'course_enrollment';

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  manualRecipients?: string[];

  @IsOptional()
  @IsString()
  platformId?: string;

  @IsOptional()
  @IsInt()
  courseId?: number;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  daysCount?: number;
}
