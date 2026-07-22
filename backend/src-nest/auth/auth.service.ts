import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || 'change-this-secret-before-production';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12;

export interface PublicUser {
  username: string;
  displayName: string;
  role: string;
}

function signPayload(value: string): string {
  return crypto.createHmac('sha256', AUTH_TOKEN_SECRET).update(value).digest('base64url');
}

function sanitize(user: { username: string; displayName: string; role: string }): PublicUser {
  return { username: user.username, displayName: user.displayName, role: user.role };
}

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async validateCredentials(username: string, password: string): Promise<PublicUser | null> {
    const user = await this.prisma.authUser.findUnique({
      where: { username: String(username ?? '').trim().toLowerCase() },
    });
    if (!user) return null;

    const ok = await bcrypt.compare(String(password ?? ''), user.passwordHash);
    if (!ok) return null;

    return sanitize(user);
  }

  createAuthToken(user: PublicUser): string {
    const payload = { ...sanitize(user), exp: Date.now() + TOKEN_TTL_MS };
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return `${encodedPayload}.${signPayload(encodedPayload)}`;
  }

  async parseAuthToken(token: string | null | undefined): Promise<PublicUser | null> {
    if (!token || typeof token !== 'string') return null;

    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return null;

    const expectedSignature = signPayload(encodedPayload);
    const signatureBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

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
