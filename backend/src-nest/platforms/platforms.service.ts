import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlatformDto } from './dto/create-platform.dto';
import { UpdatePlatformDto } from './dto/update-platform.dto';
import { normalizeUrl, slugifyPlatform, normalizeOptionalAmount } from '../common/platform-utils';
import { MoodleClient } from '../sync/moodle-client.service';

function maskToken(token: string): string {
  if (!token) return '';
  return `${token.substring(0, 6)}...${token.slice(-4)}`;
}

function toPublicCheck(check: any) {
  return { label: check.label, wsfunction: check.wsfunction, required: check.required, status: check.status, message: check.message };
}

async function runWsCheck({ label, wsfunction, required = true, execute }: any) {
  try {
    const data = await execute();
    return { label, wsfunction, required, status: 'ok', message: 'OK', data, reachedMoodle: true };
  } catch (err: any) {
    const message = err?.message || 'Error desconocido al conectar con Moodle.';
    return { label, wsfunction, required, status: 'error', message, data: null, reachedMoodle: /Moodle WS error \[/.test(message) };
  }
}

function makeSkippedCheck(label: string, wsfunction: string, required: boolean, message: string) {
  return { label, wsfunction, required, status: 'skipped', message };
}

function pickSampleCourseIds(courses: any): number[] {
  return (Array.isArray(courses) ? courses : [])
    .map((c: any) => Number(c?.id))
    .filter((id: number) => Number.isFinite(id) && id > 0)
    .slice(0, 5);
}

function findFirstAssignmentId(assignmentsData: any): number | null {
  const courses = assignmentsData?.courses || [];
  for (const course of courses) {
    for (const assignment of course.assignments || []) {
      const id = Number(assignment?.id);
      if (Number.isFinite(id) && id > 0) return id;
    }
  }
  return null;
}

function findFirstForumId(forumsData: any): number | null {
  const forums = Array.isArray(forumsData) ? forumsData : [];
  for (const forum of forums) {
    const id = Number(forum?.id);
    if (Number.isFinite(id) && id > 0) return id;
  }
  return null;
}

function findFirstDiscussionId(discussionsData: any): number | null {
  const discussions = discussionsData?.discussions || [];
  for (const d of discussions) {
    const id = Number(d?.discussion ?? d?.id);
    if (Number.isFinite(id) && id > 0) return id;
  }
  return null;
}

function buildTestSummary(connectionOk: boolean, requiredChecks: any[], optionalChecks: any[]): string {
  if (!connectionOk) return 'No fue posible conectarse al Web Service de Moodle.';

  const requiredErrors = requiredChecks.filter((c) => c.status === 'error');
  const requiredSkipped = requiredChecks.filter((c) => c.status === 'skipped');
  const optionalErrors = optionalChecks.filter((c) => c.status === 'error');
  const optionalSkipped = optionalChecks.filter((c) => c.status === 'skipped');

  if (requiredErrors.length > 0) {
    return `Conexión establecida, pero faltan permisos requeridos: ${requiredErrors.map((c) => c.wsfunction).join(', ')}.`;
  }

  if (requiredSkipped.length > 0) {
    let summary = 'Conexión correcta. No se detectaron permisos faltantes en las pruebas ejecutadas.';
    summary += ` Algunas validaciones requeridas no se pudieron completar: ${requiredSkipped.map((c) => c.wsfunction).join(', ')}.`;
    if (optionalErrors.length > 0) summary += ` Funciones opcionales no disponibles: ${optionalErrors.map((c) => c.wsfunction).join(', ')}.`;
    if (optionalSkipped.length > 0) summary += ` Algunas validaciones opcionales no se pudieron completar: ${optionalSkipped.map((c) => c.wsfunction).join(', ')}.`;
    return summary;
  }

  let summary = 'Conexión correcta y permisos requeridos OK.';
  if (optionalErrors.length > 0) summary += ` Funciones opcionales no disponibles: ${optionalErrors.map((c) => c.wsfunction).join(', ')}.`;
  if (optionalSkipped.length > 0) summary += ` Algunas validaciones opcionales no se pudieron completar: ${optionalSkipped.map((c) => c.wsfunction).join(', ')}.`;
  return summary;
}

@Injectable()
export class PlatformsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const platforms = await this.prisma.platform.findMany({ orderBy: { createdAt: 'asc' } });
    return platforms.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      url: p.url,
      source: p.url,
      token: maskToken(p.token),
      hasToken: !!p.token,
      monthlyCharge: p.monthlyCharge === null ? null : Number(p.monthlyCharge),
      costPerGb: Number(process.env.GLOBAL_COST_PER_GB || 1),
      currency: p.currency,
      isActive: p.isActive,
      hasFinancialConfig: p.monthlyCharge !== null,
    }));
  }

  private async getOrThrow(id: string) {
    const platform = await this.prisma.platform.findUnique({ where: { id } });
    if (!platform) throw new NotFoundException('Plataforma no encontrada.');
    return platform;
  }

  async create(dto: CreatePlatformDto) {
    const normalizedUrl = normalizeUrl(dto.url);
    const existing = await this.prisma.platform.findFirst({ where: { url: normalizedUrl } });
    if (existing) throw new ConflictException('Ya existe una plataforma con esa URL.');

    const monthlyCharge = normalizeOptionalAmount(dto.monthlyCharge);
    if (dto.monthlyCharge !== undefined && dto.monthlyCharge !== null && monthlyCharge === null) {
      throw new BadRequestException('monthlyCharge debe ser un número mayor o igual a 0.');
    }

    const created = await this.prisma.platform.create({
      data: {
        name: dto.name.trim(),
        slug: slugifyPlatform(dto.name || dto.url),
        url: normalizedUrl,
        token: dto.token.trim(),
        monthlyCharge,
        currency: 'USD',
        isActive: dto.isActive ?? true,
      },
    });
    return { message: 'Plataforma agregada.', id: created.id };
  }

  async update(id: string, dto: UpdatePlatformDto) {
    const platform = await this.getOrThrow(id);
    const data: any = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('name no puede estar vacío.');
      data.name = name;
    }

    if (dto.url !== undefined) {
      const normalizedUrl = normalizeUrl(dto.url);
      if (!normalizedUrl) throw new BadRequestException('url no puede estar vacía.');
      const dupe = await this.prisma.platform.findFirst({ where: { url: normalizedUrl, NOT: { id } } });
      if (dupe) throw new ConflictException('Ya existe una plataforma con esa URL.');
      data.url = normalizedUrl;
    }

    if (dto.token !== undefined && dto.token.trim()) {
      data.token = dto.token.trim();
    }

    if (dto.monthlyCharge !== undefined) {
      if (dto.monthlyCharge === null) {
        data.monthlyCharge = null;
      } else {
        const parsed = normalizeOptionalAmount(dto.monthlyCharge);
        if (parsed === null) throw new BadRequestException('monthlyCharge debe ser un número mayor o igual a 0.');
        data.monthlyCharge = parsed;
      }
    }

    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    await this.prisma.platform.update({ where: { id: platform.id }, data });
    return { message: 'Plataforma actualizada.' };
  }

  async remove(id: string) {
    const platform = await this.getOrThrow(id);
    await this.prisma.platform.delete({ where: { id: platform.id } });
    return { message: `Plataforma "${platform.name}" eliminada.` };
  }

  async testConnection(id: string) {
    const platform = await this.getOrThrow(id);
    const client = new MoodleClient(platform.url, platform.token);
    let connectionOk = false;
    const requiredChecks: any[] = [];
    const optionalChecks: any[] = [];

    const categoriesCheck = await runWsCheck({ label: 'Categorías', wsfunction: 'core_course_get_categories', required: true, execute: () => client.getCategories() });
    requiredChecks.push(toPublicCheck(categoriesCheck));
    connectionOk = connectionOk || categoriesCheck.reachedMoodle;

    const coursesCheck = await runWsCheck({ label: 'Cursos', wsfunction: 'core_course_get_courses', required: true, execute: () => client.getCourses() });
    requiredChecks.push(toPublicCheck(coursesCheck));
    connectionOk = connectionOk || coursesCheck.reachedMoodle;

    const sampleCourseIds = coursesCheck.status === 'ok' ? pickSampleCourseIds(coursesCheck.data) : [];
    const sampleCourseId = sampleCourseIds[0];

    if (!sampleCourseId) {
      requiredChecks.push(makeSkippedCheck('Contenidos del curso', 'core_course_get_contents', true, 'No se encontraron cursos para validar esta función.'));
      requiredChecks.push(makeSkippedCheck('Usuarios inscritos', 'core_enrol_get_enrolled_users', true, 'No se encontraron cursos para validar esta función.'));
      requiredChecks.push(makeSkippedCheck('Tareas', 'mod_assign_get_assignments', true, 'No se encontraron cursos para validar esta función.'));
      requiredChecks.push(makeSkippedCheck('Entregas de tareas', 'mod_assign_get_submissions', true, 'No se encontraron cursos para validar esta función.'));
      optionalChecks.push(makeSkippedCheck('Foros', 'mod_forum_get_forums_by_courses', false, 'No se encontraron cursos para validar esta función opcional.'));
      optionalChecks.push(makeSkippedCheck('Discusiones de foro', 'mod_forum_get_forum_discussions', false, 'No se encontraron foros para validar esta función opcional.'));
      optionalChecks.push(makeSkippedCheck('Posts de discusión', 'mod_forum_get_discussion_posts', false, 'No se encontraron discusiones para validar esta función opcional.'));
    } else {
      const contentsCheck = await runWsCheck({ label: 'Contenidos del curso', wsfunction: 'core_course_get_contents', required: true, execute: () => client.getCourseContents(sampleCourseId) });
      requiredChecks.push(toPublicCheck(contentsCheck));
      connectionOk = connectionOk || contentsCheck.reachedMoodle;

      const enrolledUsersCheck = await runWsCheck({ label: 'Usuarios inscritos', wsfunction: 'core_enrol_get_enrolled_users', required: true, execute: () => client.getEnrolledUsers(sampleCourseId) });
      requiredChecks.push(toPublicCheck(enrolledUsersCheck));
      connectionOk = connectionOk || enrolledUsersCheck.reachedMoodle;

      const backupFilesCheck = await runWsCheck({
        label: 'Archivos de backup del curso',
        wsfunction: 'core_files_get_files',
        required: false,
        execute: () => client.getFiles({ contextid: -1, component: 'backup', filearea: 'course', itemid: 0, filepath: '/', filename: '', contextlevel: 'course', instanceid: sampleCourseId }),
      });
      optionalChecks.push(toPublicCheck(backupFilesCheck));
      connectionOk = connectionOk || backupFilesCheck.reachedMoodle;

      const assignmentsCheck = await runWsCheck({ label: 'Tareas', wsfunction: 'mod_assign_get_assignments', required: true, execute: () => client.getAssignments(sampleCourseIds) });
      requiredChecks.push(toPublicCheck(assignmentsCheck));
      connectionOk = connectionOk || assignmentsCheck.reachedMoodle;

      const sampleAssignmentId = assignmentsCheck.status === 'ok' ? findFirstAssignmentId(assignmentsCheck.data) : null;
      if (sampleAssignmentId) {
        const submissionsCheck = await runWsCheck({ label: 'Entregas de tareas', wsfunction: 'mod_assign_get_submissions', required: true, execute: () => client.getSubmissions([sampleAssignmentId]) });
        requiredChecks.push(toPublicCheck(submissionsCheck));
        connectionOk = connectionOk || submissionsCheck.reachedMoodle;
      } else {
        requiredChecks.push(makeSkippedCheck('Entregas de tareas', 'mod_assign_get_submissions', true, 'No se encontraron tareas en los cursos de muestra para validar esta función.'));
      }

      const forumsCheck = await runWsCheck({ label: 'Foros', wsfunction: 'mod_forum_get_forums_by_courses', required: false, execute: () => client.getForumsByCourses(sampleCourseIds) });
      optionalChecks.push(toPublicCheck(forumsCheck));
      connectionOk = connectionOk || forumsCheck.reachedMoodle;

      const sampleForumId = forumsCheck.status === 'ok' ? findFirstForumId(forumsCheck.data) : null;
      if (sampleForumId) {
        const forumDiscussionsCheck = await runWsCheck({ label: 'Discusiones de foro', wsfunction: 'mod_forum_get_forum_discussions', required: false, execute: () => client.getForumDiscussions(sampleForumId) });
        optionalChecks.push(toPublicCheck(forumDiscussionsCheck));
        connectionOk = connectionOk || forumDiscussionsCheck.reachedMoodle;

        const sampleDiscussionId = forumDiscussionsCheck.status === 'ok' ? findFirstDiscussionId(forumDiscussionsCheck.data) : null;
        if (sampleDiscussionId) {
          const discussionPostsCheck = await runWsCheck({ label: 'Posts de discusión', wsfunction: 'mod_forum_get_discussion_posts', required: false, execute: () => client.getDiscussionPosts(sampleDiscussionId) });
          optionalChecks.push(toPublicCheck(discussionPostsCheck));
          connectionOk = connectionOk || discussionPostsCheck.reachedMoodle;
        } else {
          optionalChecks.push(makeSkippedCheck('Posts de discusión', 'mod_forum_get_discussion_posts', false, 'No se encontraron discusiones en los foros de muestra para validar esta función opcional.'));
        }
      } else {
        optionalChecks.push(makeSkippedCheck('Discusiones de foro', 'mod_forum_get_forum_discussions', false, 'No se encontraron foros en los cursos de muestra para validar esta función opcional.'));
        optionalChecks.push(makeSkippedCheck('Posts de discusión', 'mod_forum_get_discussion_posts', false, 'No se encontraron discusiones en los foros de muestra para validar esta función opcional.'));
      }
    }

    const requiredErrors = requiredChecks.filter((c) => c.status === 'error');
    const optionalErrors = optionalChecks.filter((c) => c.status === 'error');
    const summary = buildTestSummary(connectionOk, requiredChecks, optionalChecks);

    return {
      success: connectionOk && requiredErrors.length === 0,
      connection_ok: connectionOk,
      required_permissions_ok: requiredErrors.length === 0,
      optional_permissions_ok: optionalErrors.length === 0,
      summary,
      error: connectionOk && requiredErrors.length === 0 ? null : summary,
      required_checks: requiredChecks,
      optional_checks: optionalChecks,
    };
  }
}
