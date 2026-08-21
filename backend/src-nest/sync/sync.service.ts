import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncProgressService } from './sync-progress.service';
import { MoodleClient } from './moodle-client.service';
import { calculateFinancialMetrics, getMonthKey } from '../common/platform-utils';
import {
  isBackupFile,
  calcLegacyCourseContentTotals,
  detectBackupWsAvailability,
  detectGradesWsAvailability,
  extractCoursePercentage,
  getCourseBackupSize,
  upsertUserAccumulator,
} from './sync-helpers';

// Límites de llamadas simultáneas a la Web Service de Moodle por cada tipo de
// dato (contenido, backups, matrículas, calificaciones, foros). Se mantienen
// separados por si en el futuro hace falta ajustar uno sin afectar a los demás,
// aunque hoy todos valen 10.
const CONTENT_CONCURRENCY = 10;
const BACKUP_CONCURRENCY = 10;
const ENROL_CONCURRENCY = 10;
const GRADES_CONCURRENCY = 10;
const FORUM_CONCURRENCY = 10;
// Tamaño de lote al paginar IDs de curso/assignment en llamadas que aceptan arrays (courseids[], assignmentids[]).
const CHUNK = 50;
const DB_WRITE_CONCURRENCY = 20;

/** Señala que el usuario pidió cancelar la sincronización desde el endpoint POST /sync/cancel. */
class SyncCancelledError extends Error {
  constructor() {
    super('Sincronización cancelada por el usuario.');
    this.name = 'SyncCancelledError';
  }
}

/**
 * Ejecuta fn() sobre items en lotes de tamaño `concurrency` (en paralelo
 * dentro de cada lote, secuencial entre lotes) en vez de lanzar todas las
 * promesas a la vez, para no saturar el Moodle de origen con demasiadas
 * peticiones simultáneas. Si se pasa ensureNotCancelled, se comprueba antes
 * de cada lote (y al final) para poder abortar pronto si el usuario cancela.
 */
async function runInBatches<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
  ensureNotCancelled?: () => void,
) {
  for (let i = 0; i < items.length; i += concurrency) {
    ensureNotCancelled?.();
    await Promise.all(items.slice(i, i + concurrency).map(fn));
  }
  ensureNotCancelled?.();
}

/**
 * Orquesta la sincronización completa de una plataforma Moodle: trae cursos,
 * usuarios, tamaños de contenido/backups/tareas/foros y calificaciones vía
 * Web Services, y persiste el resultado en Postgres (tablas course,
 * moodleUser, courseEnrollment y platformSnapshot).
 */
@Injectable()
export class SyncService {
  constructor(
    private prisma: PrismaService,
    private progress: SyncProgressService,
  ) {}

  /**
   * Sincroniza una plataforma Moodle completa: recorre todos sus cursos y
   * usuarios contra la Web Service REST, calcula tamaños de almacenamiento y
   * calificaciones, y guarda todo en Postgres. Devuelve un resumen
   * ({ courses, users, totalBytes }) al terminar.
   */
  async syncPlatform(platform: { id: string; url: string; token: string; name: string; monthlyCharge: any }) {
    const client = new MoodleClient(platform.url, platform.token);

    const [categoriesRaw, coursesRaw] = await Promise.all([client.getCategories(), client.getCourses()]);

    if (!Array.isArray(coursesRaw)) {
      throw new Error('getCourses did not return an array — check token permissions');
    }
    const categories = Array.isArray(categoriesRaw) ? categoriesRaw : [];
    const courses = coursesRaw;

    const catMap: Record<number, string> = {};
    for (const cat of categories) catMap[cat.id] = cat.name;

    const courseIds: number[] = courses.map((c: any) => c.id);
    const backupWsAvailable = await detectBackupWsAvailability(client, courseIds);
    const gradesWsAvailable = await detectGradesWsAvailability(client, courseIds);

    // Estima cuántas "unidades de trabajo" tendrá la sincronización para poder
    // mostrar un progreso realista en el frontend: cada curso pasa siempre por
    // el paso de contenido y el de usuarios matriculados (2), más los pasos de
    // backup/calificaciones si esas wsfunctions están disponibles en esta
    // plataforma. El `|| 1` evita dividir por/comparar contra 0 si no hay cursos.
    const progressUnitsTotal =
      courses.length * (2 + (backupWsAvailable ? 1 : 0) + (gradesWsAvailable ? 1 : 0)) || 1;
    let progressUnitsDone = 0;
    const bumpProgress = (label: string) => {
      progressUnitsDone += 1;
      const current = this.progress.get();
      if (current) {
        current.current_step = label;
        current.items_done = Math.min(progressUnitsDone, progressUnitsTotal);
        current.items_total = progressUnitsTotal;
      }
    };
    const ensureNotCancelled = () => {
      if (this.progress.isCancelRequested()) throw new SyncCancelledError();
    };

    const courseMetaMap: Record<number, any> = {};
    for (const course of courses) {
      courseMetaMap[course.id] = {
        course_name: course.fullname,
        shortname: course.shortname || '',
        category_id: course.categoryid ?? 0,
        category_name: catMap[course.categoryid] || 'Sin categoría',
        visible: course.visible !== 0,
        start_date: course.startdate || null,
        end_date: course.enddate || null,
      };
    }

    const courseSizes: Record<number, any> = {};
    for (const id of courseIds) {
      courseSizes[id] = { content: 0, backup: 0, assignments: 0, forums: 0 };
    }

    // STEP 1: enhanced course content sizes
    await runInBatches(courses, CONTENT_CONCURRENCY, async (course: any) => {
      try {
        const sections = await client.getCourseContents(course.id);
        const totals = calcLegacyCourseContentTotals(sections, { classifyBackupByExtension: !backupWsAvailable });
        Object.assign(courseSizes[course.id], totals);
      } catch (err: any) {
        console.error(`  ⚠ Error content course ${course.id}: ${err.message}`);
      } finally {
        bumpProgress('Calculando contenido de cursos');
      }
    }, ensureNotCancelled);

    // STEP 2: Moodle backup sizes
    if (backupWsAvailable) {
      await runInBatches(courses, BACKUP_CONCURRENCY, async (course: any) => {
        try {
          courseSizes[course.id].backup += await getCourseBackupSize(client, course.id);
        } catch (err: any) {
          console.warn(`  ⚠ Error backup scan course ${course.id}: ${err.message}`);
        } finally {
          bumpProgress('Calculando copias de seguridad');
        }
      }, ensureNotCancelled);
    }

    // STEP 3a: enrolled users
    const userSizeMap: Record<string, any> = {};
    const enrollmentPairs: { courseId: number; userId: number }[] = [];
    await runInBatches(courses, ENROL_CONCURRENCY, async (course: any) => {
      try {
        const users = await client.getEnrolledUsers(course.id);
        for (const u of users) {
          upsertUserAccumulator(userSizeMap, u.id, {
            username: u.username,
            fullname: `${u.firstname || ''} ${u.lastname || ''}`.trim(),
            email: u.email || '',
          });
          enrollmentPairs.push({ courseId: course.id, userId: u.id });
        }
      } catch (err: any) {
        console.warn(`  ⚠ Error enrolled users course ${course.id}: ${err.message}`);
      } finally {
        bumpProgress('Calculando usuarios matriculados');
      }
    }, ensureNotCancelled);

    // STEP 3c: calificaciones por curso (requiere permiso habilitado en Moodle)
    const courseGradeAverages: Record<number, number | null> = {};
    const gradeAccumulatorByUser: Record<string, { sum: number; count: number }> = {};
    if (gradesWsAvailable) {
      await runInBatches(courses, GRADES_CONCURRENCY, async (course: any) => {
        try {
          const raw = await client.getGradeItems(course.id);
          const usergrades = Array.isArray(raw?.usergrades) ? raw.usergrades : [];
          let sum = 0;
          let count = 0;
          for (const ug of usergrades) {
            const percentage = extractCoursePercentage(ug.gradeitems);
            if (percentage === null) continue;
            sum += percentage;
            count += 1;
            const acc = gradeAccumulatorByUser[ug.userid] || (gradeAccumulatorByUser[ug.userid] = { sum: 0, count: 0 });
            acc.sum += percentage;
            acc.count += 1;
          }
          courseGradeAverages[course.id] = count > 0 ? sum / count : null;
        } catch (err: any) {
          console.warn(`  ⚠ Error grades course ${course.id}: ${err.message}`);
          courseGradeAverages[course.id] = null;
        } finally {
          bumpProgress('Calculando calificaciones');
        }
      }, ensureNotCancelled);
    }

    // STEP 3b: assignments + submissions
    for (let i = 0; i < courseIds.length; i += CHUNK) {
      ensureNotCancelled();
      try {
        const chunk = courseIds.slice(i, i + CHUNK);
        const assignData = await client.getAssignments(chunk);
        const assignCourses = assignData.courses || [];

        const assignToCourse: Record<number, number> = {};
        const allAssignIds: number[] = [];
        for (const ac of assignCourses) {
          for (const a of ac.assignments || []) {
            assignToCourse[a.id] = ac.id;
            allAssignIds.push(a.id);
          }
        }

        for (let j = 0; j < allAssignIds.length; j += CHUNK) {
          try {
            const subChunk = allAssignIds.slice(j, j + CHUNK);
            const subData = await client.getSubmissions(subChunk);
            const assignments = subData.assignments || [];

            for (const assign of assignments) {
              const courseId = assignToCourse[assign.assignmentid];
              for (const sub of assign.submissions || []) {
                const userId = sub.userid;
                for (const plugin of sub.plugins || []) {
                  for (const fa of plugin.fileareas || []) {
                    for (const file of fa.files || []) {
                      const fileSize = file.filesize || 0;
                      const shouldAccumulate = Boolean(courseId) && Boolean(courseSizes[courseId]);

                      if (shouldAccumulate && !backupWsAvailable && isBackupFile(file.filename)) {
                        courseSizes[courseId].backup += fileSize;
                        continue;
                      }
                      if (shouldAccumulate) {
                        courseSizes[courseId].assignments += fileSize;
                      }
                      upsertUserAccumulator(userSizeMap, userId).totalBytes += fileSize;
                    }
                  }
                }
              }
            }
          } catch (err: any) {
            console.warn(`  ⚠ Error submissions chunk: ${err.message}`);
          }
        }
      } catch (err: any) {
        console.warn(`  ⚠ Error assignments chunk: ${err.message}`);
      }
    }

    // STEP 4: forum attachments
    try {
      for (let i = 0; i < courseIds.length; i += CHUNK) {
        ensureNotCancelled();
        const chunk = courseIds.slice(i, i + CHUNK);
        let forums;
        try {
          forums = await client.getForumsByCourses(chunk);
        } catch (err: any) {
          console.warn(`    ⚠ Forums WS not available: ${err.message}`);
          break;
        }
        if (!Array.isArray(forums)) continue;

        const allDiscussions: { courseId: number; discussionId: number }[] = [];
        await runInBatches(forums, FORUM_CONCURRENCY, async (forum: any) => {
          try {
            const discResult = await client.getForumDiscussions(forum.id);
            for (const disc of discResult.discussions || []) {
              allDiscussions.push({ courseId: forum.course, discussionId: disc.discussion });
            }
          } catch {
            // skip
          }
        });

        await runInBatches(allDiscussions, FORUM_CONCURRENCY, async ({ courseId, discussionId }) => {
          try {
            const postResult = await client.getDiscussionPosts(discussionId);
            for (const post of postResult.posts || []) {
              const attachmentGroups = [post.attachments, post.messageinlinefiles].filter(Array.isArray);
              for (const group of attachmentGroups) {
                for (const att of group) {
                  const fileSize = att.filesize || 0;
                  if (courseId && courseSizes[courseId]) {
                    if (!backupWsAvailable && isBackupFile(att.filename)) {
                      courseSizes[courseId].backup += fileSize;
                    } else {
                      courseSizes[courseId].forums += fileSize;
                    }
                  }
                }
              }
            }
          } catch {
            // skip
          }
        });
      }
    } catch (err: any) {
      if (err instanceof SyncCancelledError) throw err;
      console.warn(`  ⚠ Forum scanning failed: ${err.message}`);
    }

    ensureNotCancelled();

    // STEP 5: persist to Postgres
    const now = new Date();
    const validCourseIds = courseIds.filter((id) => courseMetaMap[id]);

    await runInBatches(validCourseIds, DB_WRITE_CONCURRENCY, async (courseId) => {
      const meta = courseMetaMap[courseId];
      const sizes = courseSizes[courseId];
      try {
        await this.prisma.course.upsert({
          where: { platform_course_unique: { platformId: platform.id, courseId } },
          create: {
            platformId: platform.id,
            moodleName: platform.name,
            courseId,
            courseName: meta.course_name,
            shortname: meta.shortname,
            categoryId: meta.category_id,
            categoryName: meta.category_name,
            visible: meta.visible,
            startDate: meta.start_date,
            endDate: meta.end_date,
            averageGradePercent: courseGradeAverages[courseId] ?? null,
            sizeBytes: BigInt(sizes.content),
            backupSizeBytes: BigInt(sizes.backup),
            assignmentSizeBytes: BigInt(sizes.assignments),
            forumSizeBytes: BigInt(sizes.forums),
            syncedAt: now,
          },
          update: {
            moodleName: platform.name,
            courseName: meta.course_name,
            shortname: meta.shortname,
            categoryId: meta.category_id,
            categoryName: meta.category_name,
            visible: meta.visible,
            startDate: meta.start_date,
            endDate: meta.end_date,
            averageGradePercent: courseGradeAverages[courseId] ?? null,
            sizeBytes: BigInt(sizes.content),
            backupSizeBytes: BigInt(sizes.backup),
            assignmentSizeBytes: BigInt(sizes.assignments),
            forumSizeBytes: BigInt(sizes.forums),
            syncedAt: now,
          },
        });
      } catch (err: any) {
        console.error(`  ⚠ Error saving course ${courseId}: ${err.message}`);
      }
    });

    const userIds = Object.keys(userSizeMap);
    await runInBatches(userIds, DB_WRITE_CONCURRENCY, async (uid) => {
      const u = userSizeMap[uid];
      const gradeAcc = gradeAccumulatorByUser[uid];
      const averageGradePercent = gradeAcc && gradeAcc.count > 0 ? gradeAcc.sum / gradeAcc.count : null;
      try {
        await this.prisma.moodleUser.upsert({
          where: { platform_user_unique: { platformId: platform.id, userId: Number(uid) } },
          create: { platformId: platform.id, moodleName: platform.name, userId: Number(uid), username: u.username, fullname: u.fullname, email: u.email || '', totalSizeBytes: BigInt(u.totalBytes), averageGradePercent, syncedAt: now },
          update: { moodleName: platform.name, username: u.username, fullname: u.fullname, email: u.email || '', totalSizeBytes: BigInt(u.totalBytes), averageGradePercent, syncedAt: now },
        });
      } catch (err: any) {
        console.error(`  ⚠ Error saving user ${uid}: ${err.message}`);
      }
    });

    // Reemplazar las matrículas de esta plataforma con el snapshot actual
    // (simplifica altas/bajas de alumnos entre sincronizaciones).
    try {
      await this.prisma.courseEnrollment.deleteMany({ where: { platformId: platform.id } });
      if (enrollmentPairs.length > 0) {
        const uniquePairs = Array.from(
          new Map(
            enrollmentPairs.map((pair) => [`${pair.courseId}:${pair.userId}`, pair])
          ).values()
        );
        for (let i = 0; i < uniquePairs.length; i += CHUNK) {
          const chunk = uniquePairs.slice(i, i + CHUNK);
          await this.prisma.courseEnrollment.createMany({
            data: chunk.map((pair) => ({
              platformId: platform.id,
              courseId: pair.courseId,
              userId: pair.userId,
              syncedAt: now,
            })),
            skipDuplicates: true,
          });
        }
      }
    } catch (err: any) {
      console.warn(`  ⚠ Error saving enrollments: ${err.message}`);
    }

    const totalBytes = Object.values(courseSizes).reduce((acc: number, s: any) => acc + s.content + s.backup + s.assignments + s.forums, 0);
    const monthlyCharge = platform.monthlyCharge === null || platform.monthlyCharge === undefined ? null : Number(platform.monthlyCharge);
    const financial = calculateFinancialMetrics(totalBytes, monthlyCharge);
    const month = getMonthKey(now);

    try {
      await this.prisma.platformSnapshot.upsert({
        where: { platform_month_unique: { platformId: platform.id, month } },
        create: {
          platformId: platform.id,
          moodleName: platform.name,
          month,
          totalBytes: BigInt(totalBytes),
          monthlyCharge: financial.monthlyCharge,
          costPerGb: financial.costPerGb,
          currency: 'USD',
          income: financial.income,
          cost: financial.cost,
          margin: financial.margin,
          syncedAt: now,
        },
        update: {
          moodleName: platform.name,
          totalBytes: BigInt(totalBytes),
          monthlyCharge: financial.monthlyCharge,
          costPerGb: financial.costPerGb,
          income: financial.income,
          cost: financial.cost,
          margin: financial.margin,
          syncedAt: now,
        },
      });
    } catch (err: any) {
      console.warn(`  ⚠ Error saving platform snapshot: ${err.message}`);
    }

    await this.prisma.platform.update({ where: { id: platform.id }, data: { lastSyncedAt: now } });

    return { courses: courses.length, users: userIds.length, totalBytes };
  }

  /**
   * Punto de entrada usado por el controlador para lanzar la sincronización
   * de una plataforma sin bloquear la respuesta HTTP: inicializa el progreso
   * compartido (SyncProgressService), corre syncPlatform() y al terminar
   * marca el resultado como 'completed' o 'failed'. Los errores se capturan
   * aquí para que una promesa rota no quede sin manejar (ver el .catch en el
   * controlador, que solo cubre un fallo antes de llegar a este try/catch).
   */
  async runSinglePlatformInBackground(platformId: string) {
    const platform = await this.prisma.platform.findUniqueOrThrow({ where: { id: platformId } });

    this.progress.set({
      id: `single-${platform.id}`,
      status: 'running',
      started_at: new Date(),
      completed_at: null,
      platforms_total: 1,
      platforms_synced: 0,
      current_platform: platform.name,
      sync_errors: [],
      current_step: 'Iniciando sincronización',
      items_done: 0,
      items_total: 0,
      platform_id: platform.id,
    });

    try {
      await this.syncPlatform(platform);
      const current = this.progress.get()!;
      current.status = 'completed';
      current.completed_at = new Date();
      current.platforms_synced = 1;
      current.items_done = current.items_total;
    } catch (err: any) {
      console.error(`  ✗ ${platform.name}: ${err.message}`);
      const current = this.progress.get()!;
      current.status = 'failed';
      current.completed_at = new Date();
      current.sync_errors.push(`${platform.name}: ${err.message}`);
    }
  }

}
