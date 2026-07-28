import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncProgressService } from './sync-progress.service';
import { MoodleClient } from './moodle-client.service';
import { calculateFinancialMetrics, getMonthKey } from '../common/platform-utils';
import {
  isBackupFile,
  calcLegacyCourseContentTotals,
  detectBackupWsAvailability,
  getCourseBackupSize,
  upsertUserAccumulator,
} from './sync-helpers';

const CONTENT_CONCURRENCY = 10;
const BACKUP_CONCURRENCY = 10;
const ENROL_CONCURRENCY = 10;
const FORUM_CONCURRENCY = 10;
const CHUNK = 50;
const DB_WRITE_CONCURRENCY = 20;

async function runInBatches<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.all(items.slice(i, i + concurrency).map(fn));
  }
}

@Injectable()
export class SyncService {
  constructor(
    private prisma: PrismaService,
    private progress: SyncProgressService,
  ) {}

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

    const progressUnitsTotal = courses.length * (backupWsAvailable ? 3 : 2) || 1;
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

    const courseMetaMap: Record<number, any> = {};
    for (const course of courses) {
      courseMetaMap[course.id] = {
        course_name: course.fullname,
        shortname: course.shortname || '',
        category_id: course.categoryid ?? 0,
        category_name: catMap[course.categoryid] || 'Sin categoría',
        visible: course.visible !== 0,
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
    });

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
      });
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
    });

    // STEP 3b: assignments + submissions
    for (let i = 0; i < courseIds.length; i += CHUNK) {
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
      console.warn(`  ⚠ Forum scanning failed: ${err.message}`);
    }

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
      try {
        await this.prisma.moodleUser.upsert({
          where: { platform_user_unique: { platformId: platform.id, userId: Number(uid) } },
          create: { platformId: platform.id, moodleName: platform.name, userId: Number(uid), username: u.username, fullname: u.fullname, email: u.email || '', totalSizeBytes: BigInt(u.totalBytes), syncedAt: now },
          update: { moodleName: platform.name, username: u.username, fullname: u.fullname, email: u.email || '', totalSizeBytes: BigInt(u.totalBytes), syncedAt: now },
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

  async runFullSync() {
    const platforms = await this.prisma.platform.findMany({ where: { isActive: true } });

    const syncLog = await this.prisma.syncLog.create({
      data: { platformsTotal: platforms.length, platformsSynced: 0, status: 'running' },
    });

    this.progress.set({
      id: syncLog.id,
      status: 'running',
      started_at: syncLog.startedAt,
      completed_at: null,
      platforms_total: platforms.length,
      platforms_synced: 0,
      current_platform: '',
      sync_errors: [],
    });

    const syncErrors: string[] = [];

    try {
      for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        const current = this.progress.get()!;
        current.current_platform = p.name;

        console.log(`▶ Syncing [${i + 1}/${platforms.length}]: ${p.name}`);
        try {
          const result = await this.syncPlatform(p);
          console.log(`  ✓ ${p.name}: ${result.courses} courses, ${result.users} users`);
        } catch (err: any) {
          const msg = `${p.name}: ${err.message}`;
          console.error(`  ✗ ${msg}`);
          syncErrors.push(msg);
          current.sync_errors.push(msg);
        }

        current.platforms_synced = i + 1;
        await this.prisma.syncLog.update({
          where: { id: syncLog.id },
          data: { platformsSynced: i + 1, syncErrors },
        });
      }

      await this.prisma.syncLog.update({
        where: { id: syncLog.id },
        data: { status: 'completed', completedAt: new Date() },
      });

      const current = this.progress.get()!;
      current.status = 'completed';
      current.completed_at = new Date();
    } catch (err: any) {
      syncErrors.push(err.message);
      await this.prisma.syncLog.update({
        where: { id: syncLog.id },
        data: { status: 'failed', completedAt: new Date(), syncErrors },
      });

      const current = this.progress.get()!;
      current.status = 'failed';
      current.completed_at = new Date();
      current.sync_errors.push(err.message);
    }

    return this.progress.get();
  }
}
