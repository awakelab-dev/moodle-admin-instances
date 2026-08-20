import { PartialType } from '@nestjs/mapped-types';
import { CreatePlatformDto } from './create-platform.dto';

// Igual que CreatePlatformDto pero con todos los campos opcionales, para
// permitir actualizaciones parciales (PUT solo con los campos que cambian).
export class UpdatePlatformDto extends PartialType(CreatePlatformDto) {}
