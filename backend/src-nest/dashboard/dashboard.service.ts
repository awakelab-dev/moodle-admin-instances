import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MoodleClient } from '../sync/moodle-client.service';
import { buildCourseStorageBreakdown, deriveCourseSizeTotals, detectFileBrowserAvailability } from '../sync/sync-helpers';
import { bytesToGigabytes, calculateFinancialMetrics, normalizeUrl } from '../common/platform-utils';

function parseBooleanFlag(value?: string): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
}

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

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private async findPlatformByUrl(moodleSource: string) {
    const url = normalizeUrl(moodleSource);
    return this.prisma.platform.findFirst({ where: { url } });
  }

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
        };
      });

    return summaries.sort((a, b) => (b.totalBytes !== a.totalBytes ? b.totalBytes - a.totalBytes : a.name.localeCompare(b.name)));
  }

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

  async getCourses(moodleSource?: string) {
    const url = moodleSource ? normalizeUrl(moodleSource) : '';
    const platform = url ? await this.findPlatformByUrl(url) : null;
    if (url && !platform) {
      return { moodleSource: url, platformName: null, totalBytes: 0, totalContentBytes: 0, totalBackupBytes: 0, totalAssignmentBytes: 0, totalForumBytes: 0, categories: [] };
    }

    const courses = await this.prisma.course.findMany({ where: platform ? { platformId: platform.id } : {} });

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
      });
    }

    const categories = Object.values(catMap).sort((a: any, b: any) => b.total_bytes - a.total_bytes);
    const totalBytes = totalContentBytes + totalBackupBytes + totalAssignmentBytes + totalForumBytes;
    const platformName = url && courses.length ? courses.find((c) => c.moodleName)?.moodleName || null : null;

    return { moodleSource: url || null, platformName, totalBytes, totalContentBytes, totalBackupBytes, totalAssignmentBytes, totalForumBytes, categories };
  }

  async getCourseBreakdown(courseId: number, moodleSource: string, refreshFlag?: string) {
    if (!moodleSource) throw new BadRequestException('moodleSource es requerido para consultar el detalle del curso.');
    if (!Number.isFinite(courseId) || courseId <= 0) throw new BadRequestException('courseId inválido.');

    const platform = await this.findPlatformByUrl(moodleSource);
    if (!platform) throw new NotFoundException('Plataforma no encontrada.');

    const course = await this.prisma.course.findUnique({ where: { platform_course_unique: { platformId: platform.id, courseId } } });
    if (!course) throw new NotFoundException('Curso no encontrado.');

    const refresh = parseBooleanFlag(refreshFlag);
    const cachedRows = normalizeBreakdownRows(course.detailedStorageBreakdown);
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

    const client = new MoodleClient(platform.url, platform.token);
    const fileBrowserAvailable = await detectFileBrowserAvailability(client, [courseId]);
    if (!fileBrowserAvailable) {
      throw new ServiceUnavailableException('core_files_get_files no está disponible para calcular el detalle del curso en vivo.');
    }

    const rows = normalizeBreakdownRows(await buildCourseStorageBreakdown(client, courseId, { directoryConcurrency: 4 }));
    const derivedTotals = deriveCourseSizeTotals(rows);
    const totalBytes = derivedTotals.content + derivedTotals.backup + derivedTotals.assignments + derivedTotals.forums;
    const calculatedAt = new Date();

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
}
