import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MoodleClient } from '../sync/moodle-client.service';
import {
  buildCourseStorageBreakdown,
  deriveCourseSizeTotals,
  detectFileBrowserAvailability,
  extractCourseGradeItem,
  mapWithConcurrency,
} from '../sync/sync-helpers';
import { bytesToGigabytes, calculateFinancialMetrics, normalizeUrl } from '../common/platform-utils';

// Moodle devuelve varios campos "formatted" (nota, feedback, porcentaje) ya
// renderizados como HTML (p. ej. envueltos en <span>, con &nbsp;). Como el
// dashboard los muestra como texto plano en tablas, se limpian las etiquetas
// y entidades antes de exponerlos en la respuesta.
function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

// El "gradeformatted" del ítem de tipo "course" (nota total) a veces trae,
// tras quitar el HTML, una coletilla de si se ha superado el curso, del
// tipo "6,33 (Superar (S))" — se recorta para dejar solo el número.
function stripGradeAnnotation(value: string): string {
  return value.replace(/\s*\(.*$/, '').trim();
}

// Cada ítem de Moodle puede tener su propia nota máxima (grademax) —
// algunas actividades están configuradas sobre 10, otras sobre 100, etc.
// Se normaliza a una nota sobre 10 para que todos los ítems se puedan
// comparar entre sí en el informe, en vez de mezclar escalas distintas.
function formatScoreOutOf10(graderaw: unknown, grademax: unknown): string {
  const raw = typeof graderaw === 'number' ? graderaw : Number(graderaw);
  const max = typeof grademax === 'number' ? grademax : Number(grademax);
  if (!Number.isFinite(raw) || !Number.isFinite(max) || max <= 0) return '—';
  return ((raw / max) * 10).toFixed(2).replace('.', ',');
}

// El query param "refresh" llega siempre como string (o undefined) desde la
// URL, nunca como boolean real, por eso hace falta parsearlo a mano.
function parseBooleanFlag(value?: string): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
}

// El desglose detallado se guarda en BD como JSON (detailedStorageBreakdown)
// y puede venir con forma inesperada (datos antiguos, nulls, etc.), por eso
// se sanea/filtra/ordena antes de usarlo, tanto si viene de caché como si
// se acaba de calcular en vivo.
function normalizeBreakdownRows(rows: any = []): any[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      component: typeof row?.component === 'string' ? row.component : '',
      filearea: typeof row?.filearea === 'string' ? row.filearea : '',
      size_bytes: Number(row?.size_bytes || 0),
    }))
    .filter((row) => row.size_bytes > 0)
    .sort((a, b) => b.size_bytes - a.size_bytes);
}

// Servicio que arma todas las respuestas del dashboard. La mayoría de
// métodos leen únicamente lo que ya se sincronizó en Postgres (rápido, no
// depende de que Moodle esté disponible); solo getCourseBreakdown (en modo
// live/refresh) y getCourseAccessReport/getCourseGradesReport consultan los
// Web Services de Moodle en vivo, cada método lo indica explícitamente.
@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  // Busca la plataforma ya sincronizada por su URL (normalizada sin barra
  // final), no hace ninguna llamada a Moodle.
  private async findPlatformByUrl(moodleSource: string) {
    const url = normalizeUrl(moodleSource);
    return this.prisma.platform.findFirst({ where: { url } });
  }

  // Datos ya sincronizados: agrega el tamaño total de cursos por plataforma
  // y calcula las métricas financieras (ingreso/costo/margen) de cada una.
  // Devuelve un resumen por plataforma, ordenado por tamaño descendente.
  async getPlatformSummary(moodleSource?: string) {
    const normalizedFilter = moodleSource ? normalizeUrl(moodleSource) : '';

    const grouped = await this.prisma.course.groupBy({
      by: ['platformId'],
      _sum: { sizeBytes: true, backupSizeBytes: true, assignmentSizeBytes: true, forumSizeBytes: true },
    });
    const totalsByPlatformId = new Map(
      grouped.map((g) => [
        g.platformId,
        Number(g._sum.sizeBytes || 0) + Number(g._sum.backupSizeBytes || 0) + Number(g._sum.assignmentSizeBytes || 0) + Number(g._sum.forumSizeBytes || 0),
      ]),
    );

    const platforms = await this.prisma.platform.findMany({ where: { isActive: true } });
    const summaries = platforms
      .filter((p) => !normalizedFilter || p.url === normalizedFilter)
      .map((p) => {
        const totalBytes = totalsByPlatformId.get(p.id) || 0;
        const monthlyCharge = p.monthlyCharge === null ? null : Number(p.monthlyCharge);
        const financial = calculateFinancialMetrics(totalBytes, monthlyCharge);
        return {
          source: p.url,
          name: p.name,
          totalBytes: financial.totalBytes,
          totalGb: financial.totalGb,
          monthlyCharge: financial.monthlyCharge,
          costPerGb: financial.costPerGb,
          currency: financial.currency,
          income: financial.income,
          cost: financial.cost,
          margin: financial.margin,
          hasFinancialConfig: financial.hasFinancialConfig,
          lastSyncedAt: p.lastSyncedAt,
        };
      });

    return summaries.sort((a, b) => (b.totalBytes !== a.totalBytes ? b.totalBytes - a.totalBytes : a.name.localeCompare(b.name)));
  }

  // Datos ya sincronizados: devuelve la serie histórica mensual de tamaño y
  // métricas financieras de una plataforma, a partir de los snapshots
  // guardados en cada sincronización.
  async getPlatformHistory(moodleSource?: string) {
    if (!moodleSource) {
      throw new BadRequestException('moodleSource es requerido para consultar el histórico.');
    }
    const url = normalizeUrl(moodleSource);
    const platform = await this.prisma.platform.findFirst({ where: { url } });

    const points = await this.prisma.platformSnapshot.findMany({
      where: { platformId: platform?.id ?? '__none__' },
      orderBy: { month: 'asc' },
    });
    const latestPoint = points[points.length - 1] || null;

    return {
      moodleSource: url,
      platformName: platform?.name || latestPoint?.moodleName || url,
      currency: platform?.currency || latestPoint?.currency || 'USD',
      hasFinancialConfig: platform?.monthlyCharge !== null && platform?.monthlyCharge !== undefined,
      points: points.map((point) => ({
        month: point.month,
        totalBytes: Number(point.totalBytes || 0),
        totalGb: bytesToGigabytes(point.totalBytes),
        monthlyCharge: point.monthlyCharge === null ? null : Number(point.monthlyCharge),
        costPerGb: point.costPerGb === null ? null : Number(point.costPerGb),
        income: point.income === null ? null : Number(point.income),
        cost: point.cost === null ? null : Number(point.cost),
        margin: point.margin === null ? null : Number(point.margin),
        currency: point.currency || platform?.currency || 'USD',
        hasFinancialConfig: point.monthlyCharge !== null && point.costPerGb !== null,
        syncedAt: point.syncedAt || null,
      })),
    };
  }

  // Datos ya sincronizados: combina el histórico de snapshots de todas las
  // plataformas activas en dos series: el total global por mes y el
  // desglose por plataforma, ambas ordenadas cronológicamente.
  async getGlobalStorageHistory() {
    const snapshots = await this.prisma.platformSnapshot.findMany({
      orderBy: [{ month: 'asc' }, { moodleName: 'asc' }],
      include: { platform: true },
    });

    const totalsByMonth = new Map<string, { month: string; totalBytes: number; sources: Set<string> }>();
    const platformsBySource = new Map<string, { source: string; name: string; points: any[] }>();

    for (const snapshot of snapshots) {
      if (!snapshot.platform.isActive) continue;

      const source = snapshot.platform.url;
      const month = snapshot.month;
      const totalBytes = Number(snapshot.totalBytes || 0);

      const totalEntry = totalsByMonth.get(month) || { month, totalBytes: 0, sources: new Set<string>() };
      totalEntry.totalBytes += totalBytes;
      if (source) totalEntry.sources.add(source);
      totalsByMonth.set(month, totalEntry);

      const platformEntry = platformsBySource.get(source) || { source, name: snapshot.platform.name || snapshot.moodleName || source, points: [] };
      platformEntry.points.push({
        month,
        totalBytes,
        totalGb: bytesToGigabytes(totalBytes),
        monthlyCharge: snapshot.monthlyCharge === null ? null : Number(snapshot.monthlyCharge),
        costPerGb: snapshot.costPerGb === null ? null : Number(snapshot.costPerGb),
        income: snapshot.income === null ? null : Number(snapshot.income),
        cost: snapshot.cost === null ? null : Number(snapshot.cost),
        margin: snapshot.margin === null ? null : Number(snapshot.margin),
        currency: snapshot.currency || snapshot.platform.currency || 'USD',
        hasFinancialConfig: snapshot.monthlyCharge !== null && snapshot.costPerGb !== null,
        syncedAt: snapshot.syncedAt || null,
      });
      platformsBySource.set(source, platformEntry);
    }

    const points = Array.from(totalsByMonth.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((row) => ({ month: row.month, totalBytes: row.totalBytes, totalGb: bytesToGigabytes(row.totalBytes), platformCount: row.sources.size }));

    const platforms = Array.from(platformsBySource.values())
      .map((p) => ({ ...p, points: [...p.points].sort((a, b) => a.month.localeCompare(b.month)) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const firstPoint = points[0] || null;
    const lastPoint = points[points.length - 1] || null;

    return {
      unit: 'GB',
      period: { startMonth: firstPoint?.month || null, endMonth: lastPoint?.month || null, months: points.length },
      platformCount: platforms.length,
      points,
      platforms,
    };
  }

  // Datos ya sincronizados: agrupa los cursos de una plataforma (o de
  // todas, si no se filtra) por categoría, sumando los distintos tipos de
  // tamaño (contenido, backups, tareas, foros) a nivel de categoría y total.
  async getCourses(moodleSource?: string) {
    const url = moodleSource ? normalizeUrl(moodleSource) : '';
    const platform = url ? await this.findPlatformByUrl(url) : null;
    if (url && !platform) {
      return { moodleSource: url, platformName: null, totalBytes: 0, totalContentBytes: 0, totalBackupBytes: 0, totalAssignmentBytes: 0, totalForumBytes: 0, categories: [] };
    }

    const courseFilter = platform ? { platformId: platform.id } : {};
    const [courses, enrolledPerCourse] = await Promise.all([
      this.prisma.course.findMany({ where: courseFilter }),
      this.prisma.courseEnrollment.groupBy({
        by: ['platformId', 'courseId'],
        where: courseFilter,
        _count: { courseId: true },
      }),
    ]);
    const enrolledCountByCourse = new Map(
      enrolledPerCourse.map((row) => [`${row.platformId}:${row.courseId}`, row._count.courseId]),
    );

    const nowSeconds = Math.floor(Date.now() / 1000);
    const catMap: Record<string, any> = {};
    let totalContentBytes = 0;
    let totalBackupBytes = 0;
    let totalAssignmentBytes = 0;
    let totalForumBytes = 0;

    for (const c of courses) {
      const size = Number(c.sizeBytes);
      const backup = Number(c.backupSizeBytes);
      const assignment = Number(c.assignmentSizeBytes);
      const forum = Number(c.forumSizeBytes);

      totalContentBytes += size;
      totalBackupBytes += backup;
      totalAssignmentBytes += assignment;
      totalForumBytes += forum;

      const key = c.categoryName || 'Sin categoría';
      if (!catMap[key]) {
        catMap[key] = { category_name: key, total_bytes: 0, total_backup_bytes: 0, total_assignment_bytes: 0, total_forum_bytes: 0, courses: [] };
      }
      catMap[key].total_bytes += size;
      catMap[key].total_backup_bytes += backup;
      catMap[key].total_assignment_bytes += assignment;
      catMap[key].total_forum_bytes += forum;
      // "Histórico" si la fecha de fin ya pasó; "Activo" si no tiene fecha de
      // fin (indefinido en Moodle) o todavía no ha llegado.
      const isHistorical = Boolean(c.endDate) && c.endDate! < nowSeconds;

      catMap[key].courses.push({
        moodle_source: platform?.url || url,
        course_id: c.courseId,
        course_name: c.courseName,
        shortname: c.shortname,
        moodle_name: c.moodleName,
        size_bytes: size,
        backup_size_bytes: backup,
        assignment_size_bytes: assignment,
        forum_size_bytes: forum,
        start_date: c.startDate || null,
        end_date: c.endDate || null,
        is_historical: isHistorical,
        enrolled_count: enrolledCountByCourse.get(`${c.platformId}:${c.courseId}`) || 0,
      });
    }

    const categories = Object.values(catMap).sort((a: any, b: any) => b.total_bytes - a.total_bytes);
    const totalBytes = totalContentBytes + totalBackupBytes + totalAssignmentBytes + totalForumBytes;
    const platformName = url && courses.length ? courses.find((c) => c.moodleName)?.moodleName || null : null;

    return { moodleSource: url || null, platformName, totalBytes, totalContentBytes, totalBackupBytes, totalAssignmentBytes, totalForumBytes, categories };
  }

  // Detalle de almacenamiento de un curso por componente/filearea. Calcular
  // esto en vivo recorre archivo por archivo vía Web Services (lento, una
  // llamada por carpeta), por eso el resultado se persiste en la fila del
  // curso (detailedStorageBreakdown/detailedCalculatedAt) la primera vez que
  // se pide, y las siguientes veces se sirve desde esa caché en BD en vez de
  // recalcular. El flag `refresh` (query param) permite forzar el
  // recálculo en vivo cuando el admin quiere datos actualizados. Devuelve
  // `source: 'cache'` o `source: 'live'` según de dónde vino el resultado.
  async getCourseBreakdown(courseId: number, moodleSource: string, refreshFlag?: string) {
    if (!moodleSource) throw new BadRequestException('moodleSource es requerido para consultar el detalle del curso.');
    if (!Number.isFinite(courseId) || courseId <= 0) throw new BadRequestException('courseId inválido.');

    const platform = await this.findPlatformByUrl(moodleSource);
    if (!platform) throw new NotFoundException('Plataforma no encontrada.');

    const course = await this.prisma.course.findUnique({ where: { platform_course_unique: { platformId: platform.id, courseId } } });
    if (!course) throw new NotFoundException('Curso no encontrado.');

    const refresh = parseBooleanFlag(refreshFlag);
    const cachedRows = normalizeBreakdownRows(course.detailedStorageBreakdown);
    // Solo se usa la caché si no se pidió refresh explícito, existe una
    // fecha de cálculo previa y hay filas guardadas; si falta cualquiera de
    // esas condiciones, se recalcula en vivo más abajo.
    const hasCachedBreakdown = !refresh && Boolean(course.detailedCalculatedAt) && cachedRows.length > 0;

    if (hasCachedBreakdown) {
      const storedTotals = {
        content: Number(course.detailedSizeBytes),
        backup: Number(course.detailedBackupSizeBytes),
        assignments: Number(course.detailedAssignmentSizeBytes),
        forums: Number(course.detailedForumSizeBytes),
      };
      const storedTotalBytes = Number(course.detailedTotalBytes);
      const hasStoredTotals = storedTotalBytes > 0 || storedTotals.content > 0 || storedTotals.backup > 0 || storedTotals.assignments > 0 || storedTotals.forums > 0;
      const derivedTotals = hasStoredTotals ? storedTotals : deriveCourseSizeTotals(cachedRows);
      const totalBytes = storedTotalBytes > 0 ? storedTotalBytes : derivedTotals.content + derivedTotals.backup + derivedTotals.assignments + derivedTotals.forums;

      return {
        moodleSource: platform.url,
        platformName: course.moodleName || null,
        source: 'cache',
        calculatedAt: course.detailedCalculatedAt!.toISOString(),
        course: {
          course_id: course.courseId,
          course_name: course.courseName,
          shortname: course.shortname || '',
          category_name: course.categoryName || 'Sin categoría',
          size_bytes: derivedTotals.content,
          backup_size_bytes: derivedTotals.backup,
          assignment_size_bytes: derivedTotals.assignments,
          forum_size_bytes: derivedTotals.forums,
          total_bytes: totalBytes,
        },
        totalRows: cachedRows.length,
        rows: cachedRows,
      };
    }

    if (!platform.url || !platform.token) {
      throw new NotFoundException('La plataforma seleccionada no está configurada para calcular el detalle en vivo.');
    }

    // A partir de aquí se calcula en vivo contra Moodle (Web Services).
    const client = new MoodleClient(platform.url, platform.token);
    const fileBrowserAvailable = await detectFileBrowserAvailability(client, [courseId]);
    if (!fileBrowserAvailable) {
      throw new ServiceUnavailableException('core_files_get_files no está disponible para calcular el detalle del curso en vivo.');
    }

    const rows = normalizeBreakdownRows(await buildCourseStorageBreakdown(client, courseId, { directoryConcurrency: 4 }));
    const derivedTotals = deriveCourseSizeTotals(rows);
    const totalBytes = derivedTotals.content + derivedTotals.backup + derivedTotals.assignments + derivedTotals.forums;
    const calculatedAt = new Date();

    // Se guarda el resultado como caché para la próxima consulta. Si falla
    // el guardado no se rompe la respuesta al usuario, solo se registra el
    // aviso: el dato en vivo ya se calculó y es lo que importa devolver.
    try {
      await this.prisma.course.update({
        where: { id: course.id },
        data: {
          detailedStorageBreakdown: rows,
          detailedSizeBytes: BigInt(derivedTotals.content),
          detailedBackupSizeBytes: BigInt(derivedTotals.backup),
          detailedAssignmentSizeBytes: BigInt(derivedTotals.assignments),
          detailedForumSizeBytes: BigInt(derivedTotals.forums),
          detailedTotalBytes: BigInt(totalBytes),
          detailedCalculatedAt: calculatedAt,
        },
      });
    } catch (err: any) {
      console.warn(`  ⚠ Error saving cached detailed breakdown for course ${courseId}: ${err.message}`);
    }

    return {
      moodleSource: platform.url,
      platformName: platform.name || course.moodleName || null,
      source: 'live',
      calculatedAt: calculatedAt.toISOString(),
      course: {
        course_id: course.courseId,
        course_name: course.courseName,
        shortname: course.shortname || '',
        category_name: course.categoryName || 'Sin categoría',
        size_bytes: derivedTotals.content,
        backup_size_bytes: derivedTotals.backup,
        assignment_size_bytes: derivedTotals.assignments,
        forum_size_bytes: derivedTotals.forums,
        total_bytes: totalBytes,
      },
      totalRows: rows.length,
      rows,
    };
  }

  // Consulta en vivo contra Moodle (Web Services): combina matrícula,
  // acceso, nota final, evaluaciones y mensajes de foro por alumno para un
  // curso. No usa caché en BD porque son datos que cambian constantemente
  // (accesos, mensajes) y se piden puntualmente, no en cada sincronización.
  async getCourseAccessReport(courseId: number, moodleSource: string) {
    if (!moodleSource) throw new BadRequestException('moodleSource es requerido para consultar el informe del curso.');
    if (!Number.isFinite(courseId) || courseId <= 0) throw new BadRequestException('courseId inválido.');

    const platform = await this.findPlatformByUrl(moodleSource);
    if (!platform) throw new NotFoundException('Plataforma no encontrada.');

    const course = await this.prisma.course.findUnique({
      where: { platform_course_unique: { platformId: platform.id, courseId } },
    });
    if (!course) throw new NotFoundException('Curso no encontrado.');

    if (!platform.url || !platform.token) {
      throw new NotFoundException('La plataforma seleccionada no está configurada para consultar el informe en vivo.');
    }

    const client = new MoodleClient(platform.url, platform.token);
    const [usersRaw, activeUsersRaw] = await Promise.all([
      client.getEnrolledUsers(courseId),
      client.getActiveEnrolledUserIds(courseId).catch(() => null),
    ]);
    if (!Array.isArray(usersRaw)) {
      throw new ServiceUnavailableException('No se pudo obtener el listado de alumnos matriculados para este curso.');
    }

    // "Matrícula activa" sí se puede saber por Web Services: Moodle permite
    // filtrar por matrículas activas (options.onlyactive=1). Si un usuario
    // aparece en el listado completo pero no en el filtrado, está suspendido.
    const activeUserIds = Array.isArray(activeUsersRaw)
      ? new Set(activeUsersRaw.map((u: any) => u.id))
      : null;

    // Nota final y evaluaciones completadas por alumno: mismos datos que usa
    // el informe de calificaciones. Si la función no está habilitada, se
    // ignora sin romper el resto del informe.
    const finalGradeByUserId = new Map<number, string>();
    const evaluationsByUserId = new Map<number, { completed: number; total: number }>();
    try {
      const gradesRaw = await client.getGradeItems(courseId);
      const usergrades = Array.isArray(gradesRaw?.usergrades) ? gradesRaw.usergrades : [];
      for (const ug of usergrades) {
        const courseItem = extractCourseGradeItem(ug.gradeitems);
        if (courseItem?.gradeformatted) {
          const clean = stripGradeAnnotation(stripHtml(courseItem.gradeformatted));
          if (clean) finalGradeByUserId.set(ug.userid, clean);
        }

        const items = Array.isArray(ug.gradeitems)
          ? ug.gradeitems.filter((item: any) => item.itemtype !== 'course')
          : [];
        const completed = items.filter((item: any) => {
          const formatted = stripHtml(item.gradeformatted || '');
          return formatted && formatted !== '-' && formatted !== '—';
        }).length;
        evaluationsByUserId.set(ug.userid, { completed, total: items.length });
      }
    } catch {
      // gradereport_user_get_grade_items no disponible: se deja sin nota final.
    }

    // Actividades de aprendizaje completadas: requiere que el curso tenga
    // "Finalización de actividades" activada. Se prueba con el primer
    // alumno; si falla, se asume no disponible para todo el curso (evita
    // repetir el mismo error por cada alumno).
    const completionByUserId = new Map<number, { completed: number; total: number }>();
    if (usersRaw.length > 0) {
      let completionAvailable = true;
      try {
        await client.getActivitiesCompletionStatus(courseId, usersRaw[0].id);
      } catch {
        completionAvailable = false;
      }

      if (completionAvailable) {
        await mapWithConcurrency(usersRaw, 8, async (u: any) => {
          try {
            const raw = await client.getActivitiesCompletionStatus(courseId, u.id);
            const statuses = Array.isArray(raw?.statuses) ? raw.statuses : [];
            const completed = statuses.filter((s: any) => s.state === 1 || s.state === 2).length;
            completionByUserId.set(u.id, { completed, total: statuses.length });
          } catch {
            // se deja sin dato para este alumno en particular
          }
        });
      }
    }

    // Mensajes de foro: se recorren los foros del curso y se cuentan los
    // mensajes por autor. Si el curso no tiene foros o la función no está
    // disponible, se deja sin dato en vez de romper el informe.
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

          await mapWithConcurrency(discussions, 8, async (disc: any) => {
            try {
              const postResult = await client.getDiscussionPosts(disc.discussion);
              const posts = Array.isArray(postResult?.posts) ? postResult.posts : [];
              for (const post of posts) {
                forumMessageCountByUserId.set(
                  post.userid,
                  (forumMessageCountByUserId.get(post.userid) || 0) + 1,
                );
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

    // Moodle no expone por Web Services el número de registros/eventos, el
    // tiempo acumulado ni los correos enviados (eso vive dentro de plugins de
    // informes como block_advanced_reports, sin API). Se devuelven como
    // `null` explícitamente y el frontend los muestra con un valor fijo.
    const students = usersRaw.map((u: any) => ({
      userId: u.id,
      firstname: u.firstname || '',
      lastname: u.lastname || '',
      username: u.username || '',
      email: u.email || '',
      activeEnrollment: activeUserIds ? activeUserIds.has(u.id) : null,
      firstAccess: u.firstaccess || null,
      lastAccess: u.lastaccess || null,
      lastCourseAccess: u.lastcourseaccess || null,
      records: null,
      accumulatedTime: null,
      activitiesCompleted: completionByUserId.get(u.id)?.completed ?? null,
      activitiesTotal: completionByUserId.get(u.id)?.total ?? null,
      finalGrade: finalGradeByUserId.get(u.id) ?? null,
      evaluationsCompleted: evaluationsByUserId.get(u.id)?.completed ?? null,
      evaluationsTotal: evaluationsByUserId.get(u.id)?.total ?? null,
      forumMessageCount: forumMessagesAvailable ? forumMessageCountByUserId.get(u.id) ?? 0 : null,
      emailsSent: null,
      roles: Array.isArray(u.roles) ? u.roles.map((r: any) => r.shortname).filter(Boolean) : [],
    }));

    return {
      moodleSource: platform.url,
      platformName: platform.name || course.moodleName || null,
      calculatedAt: new Date().toISOString(),
      course: {
        course_id: course.courseId,
        course_name: course.courseName,
        shortname: course.shortname || '',
        category_name: course.categoryName || 'Sin categoría',
      },
      totalStudents: students.length,
      students,
    };
  }

  // Consulta en vivo contra Moodle (Web Services): informe de calificaciones
  // por alumno, con la nota de cada ítem normalizada además a escala /10
  // (ver formatScoreOutOf10) para poder compararlas entre sí sin importar
  // la nota máxima configurada en cada actividad.
  async getCourseGradesReport(courseId: number, moodleSource: string) {
    if (!moodleSource) throw new BadRequestException('moodleSource es requerido para consultar las calificaciones del curso.');
    if (!Number.isFinite(courseId) || courseId <= 0) throw new BadRequestException('courseId inválido.');

    const platform = await this.findPlatformByUrl(moodleSource);
    if (!platform) throw new NotFoundException('Plataforma no encontrada.');

    const course = await this.prisma.course.findUnique({
      where: { platform_course_unique: { platformId: platform.id, courseId } },
    });
    if (!course) throw new NotFoundException('Curso no encontrado.');

    if (!platform.url || !platform.token) {
      throw new NotFoundException('La plataforma seleccionada no está configurada para consultar calificaciones en vivo.');
    }

    const client = new MoodleClient(platform.url, platform.token);

    // gradereport_user_get_grade_items no está habilitado en la mayoría de
    // plataformas todavía (falta permiso del lado de Moodle) — se devuelve
    // available:false con el motivo en vez de un error duro, así el
    // frontend puede mostrar un mensaje claro en vez de romperse.
    let raw: any;
    try {
      raw = await client.getGradeItems(courseId);
    } catch (err: any) {
      return {
        moodleSource: platform.url,
        available: false,
        reason: err.message || 'gradereport_user_get_grade_items no está disponible en esta plataforma.',
        course: {
          course_id: course.courseId,
          course_name: course.courseName,
          shortname: course.shortname || '',
          category_name: course.categoryName || 'Sin categoría',
        },
        students: [],
      };
    }

    const usergrades = Array.isArray(raw?.usergrades) ? raw.usergrades : [];
    const students = usergrades.map((ug: any) => {
      const items = (Array.isArray(ug.gradeitems) ? ug.gradeitems : [])
        .filter((item: any) => item.itemtype !== 'course')
        .map((item: any) => ({
          itemName: item.itemname || 'Elemento sin nombre',
          gradeFormatted: stripHtml(item.gradeformatted || '') || '—',
          percentageFormatted: stripHtml(item.percentageformatted || '') || '—',
          scoreOutOf10: formatScoreOutOf10(item.graderaw, item.grademax),
          feedback: stripHtml(item.feedback || ''),
        }));

      const courseItem = (Array.isArray(ug.gradeitems) ? ug.gradeitems : []).find(
        (item: any) => item.itemtype === 'course',
      );

      return {
        userId: ug.userid,
        fullname: ug.userfullname || '',
        totalItems: items.length,
        completedItems: items.filter((i: any) => i.gradeFormatted !== '—' && i.gradeFormatted !== '-').length,
        coursePercentage:
          stripHtml(courseItem?.percentageformatted || '') ||
          stripGradeAnnotation(stripHtml(courseItem?.gradeformatted || '')) ||
          '—',
        courseScoreOutOf10: formatScoreOutOf10(courseItem?.graderaw, courseItem?.grademax),
        items,
      };
    });

    return {
      moodleSource: platform.url,
      available: true,
      course: {
        course_id: course.courseId,
        course_name: course.courseName,
        shortname: course.shortname || '',
        category_name: course.categoryName || 'Sin categoría',
      },
      totalStudents: students.length,
      students,
    };
  }

  // Datos ya sincronizados: top 10 usuarios por espacio ocupado. Si se
  // filtra por plataforma se usa directamente el tamaño guardado por
  // usuario; si no, se agregan los tamaños del mismo username a través de
  // todas las plataformas (un mismo alumno puede estar en varias).
  async getTopUsers(moodleSource?: string) {
    const url = moodleSource ? normalizeUrl(moodleSource) : '';

    if (url) {
      const platform = await this.findPlatformByUrl(url);
      if (!platform) return [];

      const topUsers = await this.prisma.moodleUser.findMany({
        where: { platformId: platform.id, totalSizeBytes: { gt: 0 } },
        orderBy: [{ totalSizeBytes: 'desc' }, { fullname: 'asc' }, { username: 'asc' }],
        take: 10,
      });

      return topUsers.map((u) => ({
        username: u.username,
        fullname: u.fullname,
        total_size_bytes: Number(u.totalSizeBytes),
        moodle_name: u.moodleName,
        moodle_source: platform.url,
      }));
    }

    const users = await this.prisma.moodleUser.findMany({
      where: { totalSizeBytes: { gt: 0 } },
      select: { username: true, fullname: true, totalSizeBytes: true, moodleName: true },
    });

    const byUsername = new Map<string, { username: string; fullname: string; total_size_bytes: number; platforms: Set<string> }>();
    for (const u of users) {
      const entry = byUsername.get(u.username) || { username: u.username, fullname: u.fullname, total_size_bytes: 0, platforms: new Set<string>() };
      entry.total_size_bytes += Number(u.totalSizeBytes);
      if (u.moodleName) entry.platforms.add(u.moodleName);
      if (!entry.fullname) entry.fullname = u.fullname;
      byUsername.set(u.username, entry);
    }

    return Array.from(byUsername.values())
      .sort((a, b) => (b.total_size_bytes !== a.total_size_bytes ? b.total_size_bytes - a.total_size_bytes : a.fullname.localeCompare(b.fullname)))
      .slice(0, 10)
      .map((u) => ({ username: u.username, fullname: u.fullname, total_size_bytes: u.total_size_bytes, platforms: Array.from(u.platforms) }));
  }

  // Datos ya sincronizados: estadísticas agregadas de una plataforma (o de
  // TODAS a la vez si no se pasa moodleSource — vista "Todas las
  // plataformas" del Dashboard) — cursos, alumnos, matrículas, notas
  // promedio, más los rankings de categorías y cursos con mejor nota, todo
  // calculado sobre lo que ya está en Postgres, sin tocar Moodle.
  async getInsights(moodleSource?: string) {
    let platform: { id: string; url: string; name: string } | null = null;

    if (moodleSource) {
      platform = await this.findPlatformByUrl(moodleSource);
      if (!platform) throw new NotFoundException('Plataforma no encontrada.');
    }

    const platformFilter = platform ? { platformId: platform.id } : {};

    const [courses, students, enrollmentCounts, enrolledPerCourse] = await Promise.all([
      this.prisma.course.findMany({
        where: platformFilter,
        select: {
          platformId: true,
          courseId: true,
          courseName: true,
          shortname: true,
          categoryName: true,
          visible: true,
          averageGradePercent: true,
        },
      }),
      this.prisma.moodleUser.findMany({
        where: platformFilter,
        select: { platformId: true, userId: true, fullname: true, username: true, email: true, averageGradePercent: true },
      }),
      // Se agrupa siempre por plataforma + id, porque userId/courseId son
      // ids propios de cada Moodle (no globalmente únicos) — sin platformId
      // en la clave, dos alumnos/cursos de plataformas distintas con el
      // mismo id numérico se contarían como uno solo en la vista agregada.
      this.prisma.courseEnrollment.groupBy({
        by: ['platformId', 'userId'],
        where: platformFilter,
        _count: { userId: true },
      }),
      this.prisma.courseEnrollment.groupBy({
        by: ['platformId', 'courseId'],
        where: platformFilter,
        _count: { courseId: true },
      }),
    ]);

    const courseCountByUserId = new Map(
      enrollmentCounts.map((row) => [`${row.platformId}:${row.userId}`, row._count.userId]),
    );
    const studentCountByCourseId = new Map(
      enrolledPerCourse.map((row) => [`${row.platformId}:${row.courseId}`, row._count.courseId]),
    );

    const categoryCounts = new Map<string, number>();
    for (const course of courses) {
      const key = course.categoryName || 'Sin categoría';
      categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
    }
    const topCategories = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const enrollmentsTotal = enrolledPerCourse.reduce((acc, row) => acc + row._count.courseId, 0);
    const visibleCourses = courses.filter((c) => c.visible).length;

    const gradedCourses = courses.filter((c) => c.averageGradePercent !== null);
    const gradesAvailable = gradedCourses.length > 0;
    const globalAverageGrade = gradesAvailable
      ? gradedCourses.reduce((acc, c) => acc + (c.averageGradePercent as number), 0) / gradedCourses.length
      : null;

    const topGradedCourses = [...gradedCourses]
      .sort((a, b) => (b.averageGradePercent as number) - (a.averageGradePercent as number))
      .slice(0, 10)
      .map((c) => ({ courseName: c.courseName, shortname: c.shortname, averageGradePercent: c.averageGradePercent }));

    return {
      moodleSource: platform?.url ?? null,
      platformName: platform?.name ?? 'Todas las plataformas',
      stats: {
        courses: courses.length,
        visibleCourses,
        students: students.length,
        enrollments: enrollmentsTotal,
        gradesAvailable,
        globalAverageGrade,
      },
      topCategories,
      topGradedCourses,
      courses: courses.map((c) => ({
        courseId: c.courseId,
        courseName: c.courseName,
        shortname: c.shortname,
        categoryName: c.categoryName,
        visible: c.visible,
        enrolledCount: studentCountByCourseId.get(`${c.platformId}:${c.courseId}`) || 0,
        averageGradePercent: c.averageGradePercent,
      })),
      students: students.map((u) => ({
        userId: u.userId,
        fullname: u.fullname,
        username: u.username,
        email: u.email,
        courseCount: courseCountByUserId.get(`${u.platformId}:${u.userId}`) || 0,
        averageGradePercent: u.averageGradePercent,
      })),
    };
  }
}
