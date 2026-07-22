require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const Course = require('../src/models/Course');
const MongoUser = require('../src/models/User');
const PlatformSnapshot = require('../src/models/PlatformSnapshot');
const SyncLog = require('../src/models/SyncLog');

const { readPlatformConfig, normalizeUrl, slugifyPlatform } = require('../src/config/platformConfig');
const { AUTH_USERS } = require('../src/config/authUsers');

const prisma = new PrismaClient();
const BATCH_SIZE = 500;

const DRY_RUN = process.argv.includes('--dry-run');

async function chunked(items, size, fn) {
  for (let i = 0; i < items.length; i += size) {
    await fn(items.slice(i, i + size), i);
  }
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to Mongo. Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);

  // ---- Step 1: platforms + moodle_source -> platformId map ----
  const filePlatforms = readPlatformConfig();
  const sourceKeys = filePlatforms.map((p) => normalizeUrl(p.url));

  const distinctSources = await Course.distinct('moodle_source');
  const unmatched = distinctSources.filter((s) => !sourceKeys.includes(normalizeUrl(s)));
  if (unmatched.length > 0) {
    console.warn('WARNING: moodle_source values with no matching platform in moodles.json:', unmatched);
  } else {
    console.log(`OK: all ${distinctSources.length} distinct moodle_source values match a platform in moodles.json.`);
  }

  if (DRY_RUN) {
    console.log('Dry run complete. Re-run without --dry-run to perform the migration.');
    await mongoose.disconnect();
    return;
  }

  const sourceToPlatformId = new Map();
  for (const p of filePlatforms) {
    const created = await prisma.platform.create({
      data: {
        name: p.name,
        slug: slugifyPlatform(p.name || p.url),
        url: normalizeUrl(p.url),
        token: p.token,
        monthlyCharge: p.monthlyCharge,
        currency: 'USD',
        isActive: p.isActive,
      },
    });
    sourceToPlatformId.set(normalizeUrl(p.url), created.id);
  }
  console.log(`Migrated ${filePlatforms.length} platforms.`);

  // ---- Step 2: auth users (password reset, SHA-256 can't convert to bcrypt) ----
  const KNOWN_PASSWORDS = {
    admin: 'Awakelab2026!',
  };
  for (const u of AUTH_USERS) {
    const plaintext = KNOWN_PASSWORDS[u.username];
    if (!plaintext) {
      console.warn(`No known plaintext password for user "${u.username}" - skipping, will need manual reset.`);
      continue;
    }
    const passwordHash = await bcrypt.hash(plaintext, 10);
    await prisma.authUser.create({
      data: {
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        passwordHash,
      },
    });
  }
  console.log('Migrated auth users.');

  // ---- Step 3: courses ----
  const courses = await Course.find().lean();
  let coursesMigrated = 0;
  await chunked(courses, BATCH_SIZE, async (batch) => {
    const data = batch
      .map((c) => {
        const platformId = sourceToPlatformId.get(normalizeUrl(c.moodle_source));
        if (!platformId) return null;
        return {
          platformId,
          moodleName: c.moodle_name || '',
          courseId: c.course_id,
          courseName: c.course_name,
          shortname: c.shortname || '',
          categoryId: c.category_id,
          categoryName: c.category_name || 'Sin categoría',
          sizeBytes: BigInt(c.size_bytes || 0),
          backupSizeBytes: BigInt(c.backup_size_bytes || 0),
          assignmentSizeBytes: BigInt(c.assignment_size_bytes || 0),
          forumSizeBytes: BigInt(c.forum_size_bytes || 0),
          detailedSizeBytes: BigInt(c.detailed_size_bytes || 0),
          detailedBackupSizeBytes: BigInt(c.detailed_backup_size_bytes || 0),
          detailedAssignmentSizeBytes: BigInt(c.detailed_assignment_size_bytes || 0),
          detailedForumSizeBytes: BigInt(c.detailed_forum_size_bytes || 0),
          detailedTotalBytes: BigInt(c.detailed_total_bytes || 0),
          detailedCalculatedAt: c.detailed_calculated_at || null,
          storageBreakdown: c.storage_breakdown || [],
          detailedStorageBreakdown: c.detailed_storage_breakdown || [],
          syncedAt: c.synced_at || new Date(),
        };
      })
      .filter(Boolean);
    await prisma.course.createMany({ data, skipDuplicates: true });
    coursesMigrated += data.length;
  });
  console.log(`Migrated ${coursesMigrated}/${courses.length} courses.`);

  // ---- Step 4: users ----
  const users = await MongoUser.find().lean();
  let usersMigrated = 0;
  await chunked(users, 1000, async (batch) => {
    const data = batch
      .map((u) => {
        const platformId = sourceToPlatformId.get(normalizeUrl(u.moodle_source));
        if (!platformId) return null;
        return {
          platformId,
          moodleName: u.moodle_name || '',
          userId: u.user_id,
          username: u.username,
          fullname: u.fullname || '',
          totalSizeBytes: BigInt(u.total_size_bytes || 0),
          syncedAt: u.synced_at || new Date(),
        };
      })
      .filter(Boolean);
    await prisma.moodleUser.createMany({ data, skipDuplicates: true });
    usersMigrated += data.length;
  });
  console.log(`Migrated ${usersMigrated}/${users.length} users.`);

  // ---- Step 5: platform snapshots ----
  const snapshots = await PlatformSnapshot.find().lean();
  const snapshotData = snapshots
    .map((s) => {
      const platformId = sourceToPlatformId.get(normalizeUrl(s.moodle_source));
      if (!platformId) return null;
      return {
        platformId,
        moodleName: s.moodle_name || '',
        month: s.month,
        totalBytes: BigInt(s.total_bytes || 0),
        monthlyCharge: s.monthly_charge,
        costPerGb: s.cost_per_gb,
        currency: 'USD',
        income: s.income,
        cost: s.cost,
        margin: s.margin,
        syncedAt: s.synced_at || new Date(),
      };
    })
    .filter(Boolean);
  await prisma.platformSnapshot.createMany({ data: snapshotData, skipDuplicates: true });
  console.log(`Migrated ${snapshotData.length}/${snapshots.length} platform snapshots.`);

  // ---- Step 6: sync logs ----
  const syncLogs = await SyncLog.find().lean();
  const syncLogData = syncLogs.map((l) => ({
    startedAt: l.started_at || new Date(),
    completedAt: l.completed_at || null,
    status: l.status || 'completed',
    platformsTotal: l.platforms_total || 0,
    platformsSynced: l.platforms_synced || 0,
    currentPlatform: l.current_platform || '',
    syncErrors: l.sync_errors || [],
  }));
  await prisma.syncLog.createMany({ data: syncLogData });
  console.log(`Migrated ${syncLogData.length}/${syncLogs.length} sync logs.`);

  // ---- Verification ----
  const counts = {
    platforms: await prisma.platform.count(),
    courses: await prisma.course.count(),
    moodleUsers: await prisma.moodleUser.count(),
    platformSnapshots: await prisma.platformSnapshot.count(),
    syncLogs: await prisma.syncLog.count(),
    authUsers: await prisma.authUser.count(),
  };
  console.log('Final Postgres row counts:', counts);

  await mongoose.disconnect();
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
