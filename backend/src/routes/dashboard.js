const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const PlatformSnapshot = require('../models/PlatformSnapshot');
const User = require('../models/User');
const MoodleClient = require('../services/moodleClient');
const {
  buildCourseStorageBreakdown,
  deriveCourseSizeTotals,
  detectFileBrowserAvailability,
} = require('../services/syncService');
const {
  bytesToGigabytes,
  calculateFinancialMetrics,
  hasFinancialConfig,
  isPlatformActive,
  readPlatformConfig,
} = require('../config/platformConfig');

function normalizeMoodleSource(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\/+$/, '');
}

function findPlatformBySource(moodleSource = '') {
  const normalizedSource = normalizeMoodleSource(moodleSource);
  return readPlatformConfig().find(
    (platform) => normalizeMoodleSource(platform.url) === normalizedSource
  );
}

function parseBooleanQueryFlag(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'yes' ||
    normalized === 'y' ||
    normalized === 'on'
  );
}

function normalizeBreakdownRows(rows = []) {
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

async function buildCurrentPlatformSummaries(moodleSource = '') {
  const totals = await Course.aggregate([
    {
      $group: {
        _id: {
          moodle_source: '$moodle_source',
          moodle_name: '$moodle_name',
        },
        totalBytes: {
          $sum: {
            $add: [
              { $ifNull: ['$size_bytes', 0] },
              { $ifNull: ['$backup_size_bytes', 0] },
              { $ifNull: ['$assignment_size_bytes', 0] },
              { $ifNull: ['$forum_size_bytes', 0] },
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        source: '$_id.moodle_source',
        name: '$_id.moodle_name',
        totalBytes: 1,
      },
    },
  ]);

  const normalizedFilter = normalizeMoodleSource(moodleSource);
  const totalsBySource = new Map(
    totals.map((item) => [normalizeMoodleSource(item.source), item])
  );
  const configuredPlatforms = readPlatformConfig();
  const configuredSources = new Set();
  const summaries = [];

  for (const platform of configuredPlatforms) {
    const source = normalizeMoodleSource(platform.url);
    configuredSources.add(source);
    if (!isPlatformActive(platform)) {
      continue;
    }

    if (normalizedFilter && source !== normalizedFilter) {
      continue;
    }

    const total = totalsBySource.get(source);
    const financial = calculateFinancialMetrics(total?.totalBytes || 0, platform);

    summaries.push({
      source,
      name: platform.name || total?.name || source,
      totalBytes: financial.totalBytes,
      totalGb: financial.totalGb,
      monthlyCharge: financial.monthlyCharge,
      costPerGb: financial.costPerGb,
      currency: financial.currency,
      income: financial.income,
      cost: financial.cost,
      margin: financial.margin,
      hasFinancialConfig: financial.hasFinancialConfig,
    });
  }

  for (const total of totals) {
    const source = normalizeMoodleSource(total.source);
    if (configuredSources.has(source)) continue;
    if (normalizedFilter && source !== normalizedFilter) continue;

    const financial = calculateFinancialMetrics(total.totalBytes, {});
    summaries.push({
      source,
      name: total.name || source,
      totalBytes: financial.totalBytes,
      totalGb: financial.totalGb,
      monthlyCharge: financial.monthlyCharge,
      costPerGb: financial.costPerGb,
      currency: financial.currency,
      income: financial.income,
      cost: financial.cost,
      margin: financial.margin,
      hasFinancialConfig: financial.hasFinancialConfig,
    });
  }

  return summaries.sort((a, b) => {
    if (b.totalBytes !== a.totalBytes) return b.totalBytes - a.totalBytes;
    return a.name.localeCompare(b.name);
  });
}

async function buildGlobalStorageHistory() {
  const snapshots = await PlatformSnapshot.find({})
    .sort({ month: 1, moodle_name: 1 })
    .lean();
  const configuredPlatforms = new Map(
    readPlatformConfig().map((platform) => [
      normalizeMoodleSource(platform.url),
      platform,
    ])
  );
  const totalsByMonth = new Map();
  const platformsBySource = new Map();

  snapshots.forEach((snapshot) => {
    const source = normalizeMoodleSource(snapshot.moodle_source);
    const month = snapshot.month;
    const totalBytes = Number(snapshot.total_bytes || 0);
    const configuredPlatform = configuredPlatforms.get(source);
    if (configuredPlatform && !isPlatformActive(configuredPlatform)) {
      return;
    }

    const totalEntry = totalsByMonth.get(month) || {
      month,
      totalBytes: 0,
      sources: new Set(),
    };
    totalEntry.totalBytes += totalBytes;
    if (source) totalEntry.sources.add(source);
    totalsByMonth.set(month, totalEntry);

    const platformEntry = platformsBySource.get(source) || {
      source,
      name: configuredPlatform?.name || snapshot.moodle_name || source,
      points: [],
    };
    platformEntry.points.push({
      month,
      totalBytes,
      totalGb: bytesToGigabytes(totalBytes),
      monthlyCharge:
        snapshot.monthly_charge === null || snapshot.monthly_charge === undefined
          ? null
          : snapshot.monthly_charge,
      costPerGb:
        snapshot.cost_per_gb === null || snapshot.cost_per_gb === undefined
          ? null
          : snapshot.cost_per_gb,
      income:
        snapshot.income === null || snapshot.income === undefined
          ? null
          : snapshot.income,
      cost:
        snapshot.cost === null || snapshot.cost === undefined
          ? null
          : snapshot.cost,
      margin:
        snapshot.margin === null || snapshot.margin === undefined
          ? null
          : snapshot.margin,
      currency: snapshot.currency || configuredPlatform?.currency || 'USD',
      hasFinancialConfig:
        Number.isFinite(snapshot.monthly_charge) &&
        Number.isFinite(snapshot.cost_per_gb),
      syncedAt: snapshot.synced_at || null,
    });
    platformsBySource.set(source, platformEntry);
  });

  const points = Array.from(totalsByMonth.values())
    .sort((a, b) => String(a.month || '').localeCompare(String(b.month || '')))
    .map((row) => ({
      month: row.month,
      totalBytes: row.totalBytes || 0,
      totalGb: bytesToGigabytes(row.totalBytes || 0),
      platformCount: row.sources.size,
    }));
  const platforms = Array.from(platformsBySource.values())
    .map((platform) => ({
      ...platform,
      points: [...platform.points].sort((a, b) =>
        String(a.month || '').localeCompare(String(b.month || ''))
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const firstPoint = points[0] || null;
  const lastPoint = points[points.length - 1] || null;

  return {
    unit: 'GB',
    period: {
      startMonth: firstPoint?.month || null,
      endMonth: lastPoint?.month || null,
      months: points.length,
    },
    platformCount: platforms.length,
    points,
    platforms,
  };
}

/**
 * GET /api/dashboard/platforms/summary
 * Returns the current total storage per Moodle platform.
 */
router.get('/platforms/summary', async (req, res) => {
  try {
    const moodleSource = normalizeMoodleSource(req.query.moodleSource);
    const summary = await buildCurrentPlatformSummaries(moodleSource);

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/dashboard/platforms/history
 * Returns the monthly storage and financial history for one platform.
 */
router.get('/platforms/history', async (req, res) => {
  try {
    const moodleSource = normalizeMoodleSource(req.query.moodleSource);

    if (!moodleSource) {
      return res
        .status(400)
        .json({ error: 'moodleSource es requerido para consultar el histórico.' });
    }

    const platformConfig = readPlatformConfig().find(
      (platform) => normalizeMoodleSource(platform.url) === moodleSource
    );
    const points = await PlatformSnapshot.find({ moodle_source: moodleSource })
      .sort({ month: 1 })
      .lean();
    const latestPoint = points[points.length - 1] || null;

    res.json({
      moodleSource,
      platformName:
        platformConfig?.name || latestPoint?.moodle_name || moodleSource,
      currency:
        platformConfig?.currency || latestPoint?.currency || 'CLP',
      hasFinancialConfig: hasFinancialConfig(platformConfig),
      points: points.map((point) => ({
        month: point.month,
        totalBytes: point.total_bytes || 0,
        totalGb: bytesToGigabytes(point.total_bytes || 0),
        monthlyCharge:
          point.monthly_charge === null || point.monthly_charge === undefined
            ? null
            : point.monthly_charge,
        costPerGb:
          point.cost_per_gb === null || point.cost_per_gb === undefined
            ? null
            : point.cost_per_gb,
        income:
          point.income === null || point.income === undefined
            ? null
            : point.income,
        cost:
          point.cost === null || point.cost === undefined ? null : point.cost,
        margin:
          point.margin === null || point.margin === undefined
            ? null
            : point.margin,
        currency: point.currency || platformConfig?.currency || 'CLP',
        hasFinancialConfig:
          Number.isFinite(point.monthly_charge) &&
          Number.isFinite(point.cost_per_gb),
        syncedAt: point.synced_at || null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/dashboard/platforms/history/global-storage
 * Returns the monthly storage history aggregated across all Moodle platforms.
 */
router.get('/platforms/history/global-storage', async (_req, res) => {
  try {
    const history = await buildGlobalStorageHistory();
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/dashboard/courses
 * Returns course data grouped by category with full size breakdown.
 */
router.get('/courses', async (req, res) => {
  try {
    const moodleSource = normalizeMoodleSource(req.query.moodleSource);
    const query = moodleSource ? { moodle_source: moodleSource } : {};
    const courses = await Course.find(query).lean();

    // Group by category_name
    const catMap = {};
    let totalContentBytes = 0;
    let totalBackupBytes = 0;
    let totalAssignmentBytes = 0;
    let totalForumBytes = 0;

    for (const c of courses) {
      totalContentBytes += c.size_bytes || 0;
      totalBackupBytes += c.backup_size_bytes || 0;
      totalAssignmentBytes += c.assignment_size_bytes || 0;
      totalForumBytes += c.forum_size_bytes || 0;

      const key = c.category_name || 'Sin categoría';
      if (!catMap[key]) {
        catMap[key] = {
          category_name: key,
          total_bytes: 0,
          total_backup_bytes: 0,
          total_assignment_bytes: 0,
          total_forum_bytes: 0,
          courses: [],
        };
      }
      catMap[key].total_bytes += c.size_bytes || 0;
      catMap[key].total_backup_bytes += c.backup_size_bytes || 0;
      catMap[key].total_assignment_bytes += c.assignment_size_bytes || 0;
      catMap[key].total_forum_bytes += c.forum_size_bytes || 0;
      catMap[key].courses.push({
        moodle_source: c.moodle_source,
        course_id: c.course_id,
        course_name: c.course_name,
        shortname: c.shortname,
        moodle_name: c.moodle_name,
        size_bytes: c.size_bytes || 0,
        backup_size_bytes: c.backup_size_bytes || 0,
        assignment_size_bytes: c.assignment_size_bytes || 0,
        forum_size_bytes: c.forum_size_bytes || 0,
      });
    }

    // Sort categories by total size descending
    const categories = Object.values(catMap).sort(
      (a, b) => b.total_bytes - a.total_bytes
    );

    const totalBytes = totalContentBytes + totalBackupBytes + totalAssignmentBytes + totalForumBytes;
    const platformName =
      moodleSource && courses.length
        ? courses.find((course) => course.moodle_name)?.moodle_name || null
        : null;

    res.json({
      moodleSource: moodleSource || null,
      platformName,
      totalBytes,
      totalContentBytes,
      totalBackupBytes,
      totalAssignmentBytes,
      totalForumBytes,
      categories,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/dashboard/courses/:courseId/breakdown
 * Returns a cached or live component/filearea breakdown for one course.
 */
router.get('/courses/:courseId/breakdown', async (req, res) => {
  try {
    const moodleSource = normalizeMoodleSource(req.query.moodleSource);
    const refresh = parseBooleanQueryFlag(req.query.refresh);
    const courseId = Number(req.params.courseId);

    if (!moodleSource) {
      return res
        .status(400)
        .json({ error: 'moodleSource es requerido para consultar el detalle del curso.' });
    }

    if (!Number.isFinite(courseId) || courseId <= 0) {
      return res.status(400).json({ error: 'courseId inválido.' });
    }

    const course = await Course.findOne({
      moodle_source: moodleSource,
      course_id: courseId,
    }).lean();

    if (!course) {
      return res.status(404).json({ error: 'Curso no encontrado.' });
    }

    const cachedRows = normalizeBreakdownRows(course.detailed_storage_breakdown);
    const hasCachedBreakdown =
      !refresh &&
      Boolean(course.detailed_calculated_at) &&
      cachedRows.length > 0;

    if (hasCachedBreakdown) {
      const storedTotals = {
        content: Number(course.detailed_size_bytes || 0),
        backup: Number(course.detailed_backup_size_bytes || 0),
        assignments: Number(course.detailed_assignment_size_bytes || 0),
        forums: Number(course.detailed_forum_size_bytes || 0),
      };
      const storedTotalBytes = Number(course.detailed_total_bytes || 0);
      const hasStoredTotals =
        storedTotalBytes > 0 ||
        storedTotals.content > 0 ||
        storedTotals.backup > 0 ||
        storedTotals.assignments > 0 ||
        storedTotals.forums > 0;
      const derivedTotals = hasStoredTotals
        ? storedTotals
        : deriveCourseSizeTotals(cachedRows);
      const totalBytes =
        storedTotalBytes > 0
          ? storedTotalBytes
          : (derivedTotals.content || 0) +
            (derivedTotals.backup || 0) +
            (derivedTotals.assignments || 0) +
            (derivedTotals.forums || 0);
      const calculatedAt = new Date(course.detailed_calculated_at).toISOString();

      return res.json({
        moodleSource,
        platformName: course.moodle_name || null,
        source: 'cache',
        calculatedAt,
        course: {
          course_id: course.course_id,
          course_name: course.course_name,
          shortname: course.shortname || '',
          category_name: course.category_name || 'Sin categoría',
          size_bytes: derivedTotals.content || 0,
          backup_size_bytes: derivedTotals.backup || 0,
          assignment_size_bytes: derivedTotals.assignments || 0,
          forum_size_bytes: derivedTotals.forums || 0,
          total_bytes: totalBytes,
        },
        totalRows: cachedRows.length,
        rows: cachedRows,
      });
    }
    const platform = findPlatformBySource(moodleSource);
    if (!platform?.url || !platform?.token) {
      return res
        .status(404)
        .json({ error: 'La plataforma seleccionada no está configurada para calcular el detalle en vivo.' });
    }

    const client = new MoodleClient(platform.url, platform.token);
    const fileBrowserAvailable = await detectFileBrowserAvailability(client, [courseId]);
    if (!fileBrowserAvailable) {
      return res
        .status(503)
        .json({ error: 'core_files_get_files no está disponible para calcular el detalle del curso en vivo.' });
    }

    const rows = normalizeBreakdownRows(
      await buildCourseStorageBreakdown(client, courseId, {
        directoryConcurrency: 4,
      })
    );
    const derivedTotals = deriveCourseSizeTotals(rows);
    const totalBytes =
      (derivedTotals.content || 0) +
      (derivedTotals.backup || 0) +
      (derivedTotals.assignments || 0) +
      (derivedTotals.forums || 0);
    const calculatedAt = new Date();

    try {
      await Course.updateOne(
        { _id: course._id },
        {
          $set: {
            detailed_storage_breakdown: rows,
            detailed_size_bytes: derivedTotals.content || 0,
            detailed_backup_size_bytes: derivedTotals.backup || 0,
            detailed_assignment_size_bytes: derivedTotals.assignments || 0,
            detailed_forum_size_bytes: derivedTotals.forums || 0,
            detailed_total_bytes: totalBytes,
            detailed_calculated_at: calculatedAt,
          },
        }
      );
    } catch (persistError) {
      console.warn(
        `  ⚠ Error saving cached detailed breakdown for course ${courseId}: ${persistError.message}`
      );
    }

    res.json({
      moodleSource,
      platformName: platform.name || course.moodle_name || null,
      source: 'live',
      calculatedAt: calculatedAt.toISOString(),
      course: {
        course_id: course.course_id,
        course_name: course.course_name,
        shortname: course.shortname || '',
        category_name: course.category_name || 'Sin categoría',
        size_bytes: derivedTotals.content || 0,
        backup_size_bytes: derivedTotals.backup || 0,
        assignment_size_bytes: derivedTotals.assignments || 0,
        forum_size_bytes: derivedTotals.forums || 0,
        total_bytes: totalBytes,
      },
      totalRows: rows.length,
      rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/dashboard/users/top
 * Returns the Top 10 users by total storage, optionally filtered by platform.
 */
router.get('/users/top', async (req, res) => {
  try {
    const moodleSource = normalizeMoodleSource(req.query.moodleSource);

    if (moodleSource) {
      const topUsers = await User.find({
        moodle_source: moodleSource,
        total_size_bytes: { $gt: 0 },
      })
        .sort({ total_size_bytes: -1, fullname: 1, username: 1 })
        .limit(10)
        .lean();

      return res.json(
        topUsers.map((user) => ({
          username: user.username,
          fullname: user.fullname,
          total_size_bytes: user.total_size_bytes,
          moodle_name: user.moodle_name,
          moodle_source: user.moodle_source,
        }))
      );
    }
    const top = await User.aggregate([
      {
        $match: {
          total_size_bytes: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: '$username',
          fullname: { $first: '$fullname' },
          total_size_bytes: { $sum: '$total_size_bytes' },
          platforms: { $addToSet: '$moodle_name' },
        },
      },
      { $sort: { total_size_bytes: -1, fullname: 1, _id: 1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          username: '$_id',
          fullname: 1,
          total_size_bytes: 1,
          platforms: 1,
        },
      },
    ]);

    res.json(top);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
