import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || 'change-this-secret-before-production';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12;

// Forma del usuario que se expone fuera de este servicio (nunca incluye el
// hash de la contraseña).
export interface PublicUser {
  username: string;
  displayName: string;
  role: string;
}

// Firma HMAC del payload del token, para poder detectar si fue alterado
// sin necesidad de una librería JWT.
function signPayload(value: string): string {
  return crypto.createHmac('sha256', AUTH_TOKEN_SECRET).update(value).digest('base64url');
}

function sanitize(user: { username: string; displayName: string; role: string }): PublicUser {
  return { username: user.username, displayName: user.displayName, role: user.role };
}

// Autenticación propia del dashboard (no usa OAuth/Moodle): valida
// credenciales contra la tabla auth_users (bcrypt) y emite/valida un token
// firmado con HMAC en vez de JWT estándar, para no añadir una dependencia
// nueva solo para esto.
@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  // Verifica usuario/contraseña contra la BD (bcrypt). Devuelve el usuario
  // público si son válidas, o null si el usuario no existe o la
  // contraseña no coincide.
  async validateCredentials(username: string, password: string): Promise<PublicUser | null> {
    const user = await this.prisma.authUser.findUnique({
      where: { username: String(username ?? '').trim().toLowerCase() },
    });
    if (!user) return null;

    const ok = await bcrypt.compare(String(password ?? ''), user.passwordHash);
    if (!ok) return null;

    return sanitize(user);
  }

  // Genera el token de sesión: payload (usuario + fecha de expiración) en
  // base64url, seguido de su firma HMAC. Formato "payload.firma".
  createAuthToken(user: PublicUser): string {
    const payload = { ...sanitize(user), exp: Date.now() + TOKEN_TTL_MS };
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return `${encodedPayload}.${signPayload(encodedPayload)}`;
  }

  // Valida y decodifica el token de sesión emitido por createAuthToken.
  // Comprueba la firma, la expiración y que el usuario/rol sigan existiendo
  // y coincidiendo en BD (por si el rol cambió después de emitir el token).
  // Devuelve el usuario público, o null si el token es inválido/expiró.
  async parseAuthToken(token: string | null | undefined): Promise<PublicUser | null> {
    if (!token || typeof token !== 'string') return null;

    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return null;

    const expectedSignature = signPayload(encodedPayload);
    const signatureBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    // Comparación en tiempo constante para no filtrar por timing si la
    // firma es correcta o no (evita ataques de timing sobre la firma).
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }

    let payload: any = null;
    try {
      payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    } catch {
      return null;
    }

    if (!payload?.username || !payload?.exp || payload.exp < Date.now()) {
      return null;
    }

    const user = await this.prisma.authUser.findUnique({ where: { username: payload.username } });
    if (!user) return null;

    const publicUser = sanitize(user);
    if (publicUser.role !== payload.role) return null;

    return publicUser;
  }
}
