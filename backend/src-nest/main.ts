import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

const cors = require('cors');

// Limitador simple en memoria (sin dependencias nuevas) para proteger el
// login de fuerza bruta. No se aplica a otras rutas para no interferir con
// el sondeo continuo que hace el propio frontend (estado de sync, etc.).
function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: any, res: any, next: any) => {
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      res.status(429).json({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
      });
      return;
    }
    next();
  };
}

// Si no se configura CORS_ORIGIN en el entorno, se permite cualquier origen
// (comportamiento anterior) para no romper el despliegue en Render mientras
// no se conozca/configure ahí la URL real del frontend. En cuanto se añada
// la variable de entorno CORS_ORIGIN en Render (con esa URL), queda
// restringido de verdad.
const CORS_ORIGIN = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : true;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Render pone un proxy delante del backend: sin esto, req.ip devuelve la
  // IP interna del proxy (la misma para todo el trafico) en vez de la IP
  // real de cada cliente, y el limitador de login de abajo trataria a
  // todos los usuarios como si fueran uno solo compartiendo el mismo
  // contador de intentos.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(
    cors({
      origin: CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use('/api/auth/login', createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  const port = process.env.PORT || process.env.NEST_PORT || 5001;
  await app.listen(port);
  console.log(`✓ NestJS backend running on http://localhost:${port}/api`);
}

bootstrap();
