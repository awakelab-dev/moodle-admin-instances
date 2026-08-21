import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MoodleClient } from './moodle-client.service';
import {
  extractCourseGradeItem,
  formatScoreOutOf10,
  mapWithConcurrency,
  stripGradeAnnotation,
  stripHtml,
} from './sync-helpers';

// Cuántos cursos se procesan a la vez. Más bajo que el sync de storage
// porque cada curso aquí dispara muchas más llamadas por dentro (matrícula,
// calificaciones, finalización de actividades POR ALUMNO, foros).
const COURSE_CONCURRENCY = 4;
const COMPLETION_CONCURRENCY = 8;
const FORUM_CONCURRENCY = 8;
const DB_CHUNK = 200;

/**
 * Trae matrícula, accesos, calificaciones por ítem, finalización de
 * actividades y mensajes de foro POR ALUMNO de cada curso de una
 * plataforma, y lo guarda en CourseEnrollment. Es la misma información que
 * antes se consultaba en vivo al abrir un curso (ver
 * DashboardService.getCourseAccessReport/getCourseGradesReport). Forma
 * parte de la sincronización única de la plataforma (SyncService la llama
 * como una fase más, con el mismo progreso/cancelación que el resto) —
 * no tiene su propio endpoint ni botón: sincronizar desde Configuración o
 * desde Cursos y Alumnos dispara siempre la misma sincronización completa.
 */
@Injectable()
export class CoursesSyncService {
  constructor(private prisma: PrismaService) {}

  async syncPlatformCourseDetails(
    platform: { id: string; url: string; token: string; name: string },
    onProgress: (label: string, done: number, total: number) => void,
    ensureNotCancelled: () => void,
  ) {
    const client = new MoodleClient(platform.url, platform.token);
    const coursesRaw = await client.getCourses();
    if (!Array.isArray(coursesRaw)) {
      throw new Error('getCourses no devolvió un array — revisa el token/permisos de la plataforma.');
    }
    const courseIds: number[] = coursesRaw.map((c: any) => c.id);

    const total = courseIds.length || 1;
    let done = 0;

    const enrollmentRows: any[] = [];

    await this.runInBatches(courseIds, COURSE_CONCURRENCY, async (courseId) => {
      try {
        await this.syncOneCourse(client, platform.id, courseId, enrollmentRows);
      } catch (err: any) {
        console.warn(`  ⚠ [courses-sync] Error curso ${courseId}: ${err.message}`);
      } finally {
        done += 1;
        onProgress(`Sincronizando alumnos y calificaciones (curso ${done}/${total})`, done, total);
      }
    }, ensureNotCancelled);

    ensureNotCancelled();

    // Igual que el sync de storage: se reemplaza el snapshot completo de la
    // plataforma en vez de ir actualizando fila a fila (simplifica altas/
    // bajas de alumnos entre sincronizaciones).
    await this.prisma.courseEnrollment.deleteMany({ where: { platformId: platform.id } });
    for (let i = 0; i < enrollmentRows.length; i += DB_CHUNK) {
      const chunk = enrollmentRows.slice(i, i + DB_CHUNK);
      await this.prisma.courseEnrollment.createMany({ data: chunk, skipDuplicates: true });
    }

    const now = new Date();
    await this.prisma.platform.update({ where: { id: platform.id }, data: { coursesLastSyncedAt: now } });

    return { courses: courseIds.length, enrollments: enrollmentRows.length };
  }

  private async runInBatches<T>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<void>,
    ensureNotCancelled: () => void,
  ) {
    for (let i = 0; i < items.length; i += concurrency) {
      ensureNotCancelled();
      await Promise.all(items.slice(i, i + concurrency).map(fn));
    }
    ensureNotCancelled();
  }

  // Trae y compone el snapshot completo de un curso (matrícula, accesos,
  // calificaciones por ítem, finalización de actividades, mensajes de
  // foro) y añade una fila por alumno a `enrollmentRows`. Misma lógica que
  // dashboard.service.ts's getCourseAccessReport/getCourseGradesReport,
  // pero para persistir en vez de devolver en vivo.
  private async syncOneCourse(
    client: MoodleClient,
    platformId: string,
    courseId: number,
    enrollmentRows: any[],
  ) {
    const [usersRaw, activeUsersRaw] = await Promise.all([
      client.getEnrolledUsers(courseId),
      client.getActiveEnrolledUserIds(courseId).catch(() => null),
    ]);
    if (!Array.isArray(usersRaw) || usersRaw.length === 0) return;

    const activeUserIds = Array.isArray(activeUsersRaw)
      ? new Set(activeUsersRaw.map((u: any) => u.id))
      : null;

    const finalGradeByUserId = new Map<number, string>();
    const evaluationsByUserId = new Map<number, { completed: number; total: number }>();
    const gradeItemsByUserId = new Map<number, any[]>();
    const coursePercentageByUserId = new Map<number, string>();
    const courseScoreByUserId = new Map<number, string>();
    try {
      const gradesRaw = await client.getGradeItems(courseId);
      const usergrades = Array.isArray(gradesRaw?.usergrades) ? gradesRaw.usergrades : [];
      for (const ug of usergrades) {
        const courseItem = extractCourseGradeItem(ug.gradeitems);
        if (courseItem?.gradeformatted) {
          const clean = stripGradeAnnotation(stripHtml(courseItem.gradeformatted));
          if (clean) finalGradeByUserId.set(ug.userid, clean);
        }
        if (courseItem) {
          const percentage =
            stripHtml(courseItem.percentageformatted || '') ||
            stripGradeAnnotation(stripHtml(courseItem.gradeformatted || '')) ||
            '—';
          coursePercentageByUserId.set(ug.userid, percentage);
          courseScoreByUserId.set(ug.userid, formatScoreOutOf10(courseItem.graderaw, courseItem.grademax));
        }

        const items = (Array.isArray(ug.gradeitems) ? ug.gradeitems : []).filter(
          (item: any) => item.itemtype !== 'course',
        );
        const formattedItems = items.map((item: any) => ({
          itemName: item.itemname || 'Elemento sin nombre',
          gradeFormatted: stripHtml(item.gradeformatted || '') || '—',
          percentageFormatted: stripHtml(item.percentageformatted || '') || '—',
          scoreOutOf10: formatScoreOutOf10(item.graderaw, item.grademax),
          feedback: stripHtml(item.feedback || ''),
        }));
        gradeItemsByUserId.set(ug.userid, formattedItems);
        const completed = formattedItems.filter((i: any) => i.gradeFormatted !== '—').length;
        evaluationsByUserId.set(ug.userid, { completed, total: items.length });
      }
    } catch {
      // gradereport_user_get_grade_items no disponible en esta plataforma.
    }

    const completionByUserId = new Map<number, { completed: number; total: number }>();
    let completionAvailable = true;
    try {
      await client.getActivitiesCompletionStatus(courseId, usersRaw[0].id);
    } catch {
      completionAvailable = false;
    }
    if (completionAvailable) {
      await mapWithConcurrency(usersRaw, COMPLETION_CONCURRENCY, async (u: any) => {
        try {
          const raw = await client.getActivitiesCompletionStatus(courseId, u.id);
          const statuses = Array.isArray(raw?.statuses) ? raw.statuses : [];
          const completed = statuses.filter((s: any) => s.state === 1 || s.state === 2).length;
          completionByUserId.set(u.id, { completed, total: statuses.length });
        } catch {
          // sin dato para este alumno en particular
        }
      });
    }

    const forumMessageCountByUserId = new Map<number, number>();
    let forumMessagesAvailable = false;
    try {
      const forums = await client.getForumsByCourses([courseId]);
      if (Array.isArray(forums)) {
        forumMessagesAvailable = true;
        for (const forum of forums) {
          let discussions: any[] = [];
          try {
            const discResult = await client.getForumDiscussions(forum.id);
            discussions = Array.isArray(discResult?.discussions) ? discResult.discussions : [];
          } catch {
            continue;
          }
          await mapWithConcurrency(discussions, FORUM_CONCURRENCY, async (disc: any) => {
            try {
              const postResult = await client.getDiscussionPosts(disc.discussion);
              const posts = Array.isArray(postResult?.posts) ? postResult.posts : [];
              for (const post of posts) {
                forumMessageCountByUserId.set(post.userid, (forumMessageCountByUserId.get(post.userid) || 0) + 1);
              }
            } catch {
              // se ignora esta discusión puntual
            }
          });
        }
      }
    } catch {
      // mod_forum_get_forums_by_courses no disponible
    }

    for (const u of usersRaw) {
      enrollmentRows.push({
        platformId,
        courseId,
        userId: u.id,
        firstname: u.firstname || '',
        lastname: u.lastname || '',
        username: u.username || '',
        email: u.email || '',
        roles: Array.isArray(u.roles) ? u.roles.map((r: any) => r.shortname).filter(Boolean) : [],
        activeEnrollment: activeUserIds ? activeUserIds.has(u.id) : null,
        firstAccess: u.firstaccess || null,
        lastAccess: u.lastaccess || null,
        lastCourseAccess: u.lastcourseaccess || null,
        activitiesCompleted: completionByUserId.get(u.id)?.completed ?? null,
        activitiesTotal: completionByUserId.get(u.id)?.total ?? null,
        finalGrade: finalGradeByUserId.get(u.id) ?? null,
        evaluationsCompleted: evaluationsByUserId.get(u.id)?.completed ?? null,
        evaluationsTotal: evaluationsByUserId.get(u.id)?.total ?? null,
        forumMessageCount: forumMessagesAvailable ? forumMessageCountByUserId.get(u.id) ?? 0 : null,
        coursePercentage: coursePercentageByUserId.get(u.id) ?? null,
        courseScoreOutOf10: courseScoreByUserId.get(u.id) ?? null,
        gradeItems: gradeItemsByUserId.get(u.id) ?? [],
      });
    }
  }
}
