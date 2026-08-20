import { SetMetadata } from '@nestjs/common';

// Decorador para marcar una ruta como accesible sin autenticación (p. ej.
// POST /auth/login). AuthGuard revisa este metadato antes de exigir token.
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
