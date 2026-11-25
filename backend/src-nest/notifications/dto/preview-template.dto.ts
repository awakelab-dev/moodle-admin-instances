import { IsOptional, IsString, MinLength } from 'class-validator';

export class PreviewTemplateDto {
  @IsString()
  @MinLength(1)
  subject: string;

  @IsString()
  bodyHtml: string;

  @IsOptional()
  @IsString()
  designKey?: string;
}
