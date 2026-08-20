import { SetMetadata } from '@nestjs/common';

// Decorador para restringir una ruta a ciertos roles (p. ej. @Roles('admin')).
// RolesGuard lee este metadato y compara contra el rol del usuario actual.
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
