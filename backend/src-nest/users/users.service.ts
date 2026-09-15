import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { PublicUser } from '../auth/auth.service';

// Gestión de usuarios del dashboard (no de Moodle) y de qué plataformas
// puede ver cada uno en Moodle Insights. Solo accesible para superadmin
// (rol "admin") — ver @Roles('admin') en UsersController. Los usuarios con
// rol "limited" ven únicamente las plataformas que se les asignen aquí; los
// "admin" siempre ven todas, sin pasar por esta tabla.
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private async toPublic(user: {
    id: string;
    username: string;
    displayName: string;
    role: string;
    createdAt: Date;
  }) {
    const access = await this.prisma.userPlatformAccess.findMany({
      where: { userId: user.id },
      include: { platform: { select: { id: true, name: true } } },
    });
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      createdAt: user.createdAt,
      platforms: access.map((a) => ({ id: a.platform.id, name: a.platform.name })),
    };
  }

  async findAll() {
    const users = await this.prisma.authUser.findMany({ orderBy: { createdAt: 'asc' } });
    return Promise.all(users.map((u) => this.toPublic(u)));
  }

  async create(dto: CreateUserDto) {
    const username = dto.username.trim().toLowerCase();
    const existing = await this.prisma.authUser.findUnique({ where: { username } });
    if (existing) throw new ConflictException('Ya existe un usuario con ese nombre.');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const created = await this.prisma.authUser.create({
      data: {
        username,
        displayName: dto.displayName.trim(),
        role: dto.role,
        passwordHash,
      },
    });

    if (dto.role === 'limited' && dto.platformIds?.length) {
      await this.setPlatformAccess(created.id, dto.platformIds);
    }

    return this.toPublic(created);
  }

  async update(id: string, dto: UpdateUserDto, currentUser: PublicUser) {
    const user = await this.prisma.authUser.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    // Un superadmin no puede quitarse a sí mismo el rol de admin — evita
    // dejar la app sin ningún superadmin que pueda revertirlo.
    if (id === currentUser.id && dto.role && dto.role !== 'admin') {
      throw new ForbiddenException('No puedes quitarte tu propio rol de superadmin.');
    }

    const data: any = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName.trim();
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);

    const updated = await this.prisma.authUser.update({ where: { id }, data });

    if (dto.platformIds !== undefined) {
      await this.setPlatformAccess(id, dto.platformIds);
    }

    return this.toPublic(updated);
  }

  async remove(id: string, currentUser: PublicUser) {
    if (id === currentUser.id) {
      throw new ForbiddenException('No puedes eliminar tu propio usuario.');
    }
    const user = await this.prisma.authUser.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    if (user.role === 'admin') {
      const adminCount = await this.prisma.authUser.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        throw new BadRequestException('No se puede eliminar el último superadmin.');
      }
    }

    await this.prisma.authUser.delete({ where: { id } });
    return { message: `Usuario "${user.displayName}" eliminado.` };
  }

  // Reemplaza la lista completa de plataformas permitidas de un usuario
  // (borra y vuelve a crear, igual que el patrón usado en CoursesSyncService
  // para reemplazar snapshots completos en vez de ir fila a fila).
  private async setPlatformAccess(userId: string, platformIds: string[]) {
    await this.prisma.userPlatformAccess.deleteMany({ where: { userId } });
    if (!platformIds.length) return;
    await this.prisma.userPlatformAccess.createMany({
      data: platformIds.map((platformId) => ({ userId, platformId })),
      skipDuplicates: true,
    });
  }

  // Usado por PlatformsService/DashboardService para filtrar qué puede ver
  // un usuario "limited". Devuelve null para admin (sin restricción — ver
  // todas), o el array de ids permitidos (puede estar vacío) para limited.
  async getPermittedPlatformIds(user: PublicUser): Promise<string[] | null> {
    if (user.role === 'admin') return null;
    const access = await this.prisma.userPlatformAccess.findMany({
      where: { userId: user.id },
      select: { platformId: true },
    });
    return access.map((a) => a.platformId);
  }
}
