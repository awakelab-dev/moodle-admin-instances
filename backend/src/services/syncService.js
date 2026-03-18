const MoodleClient = require('./moodleClient');
const Course = require('../models/Course');
const PlatformSnapshot = require('../models/PlatformSnapshot');
const User = require('../models/User');
const SyncLog = require('../models/SyncLog');
const {
  calculateFinancialMetrics,
  getMonthKey,
  isPlatformActive,
  readPlatformConfig,
} = require('../config/platformConfig');

/* ─── In-memory progress (for live polling) ─── */
let currentProgress = null;

function getProgress() {
  return currentProgress;
}

/* ─── Helpers ─── */

const BACKUP_EXTENSIONS = ['.mbz'];

function isBackupFile(filename) {
  if (!filename) return false;
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return false;
  const ext = filename.substring(dotIndex).toLowerCase();
  return BACKUP_EXTENSIONS.includes(ext);
}

function calcCourseSize(sections) {
  let size = 0;
  for (const section of sections) {
    if (!section.modules) continue;
    for (const mod of section.modules) {
      if (!mod.contents) continue;
      for (const file of mod.contents) {
        if (file.type === 'file') {
          size += file.filesize || 0;
        }
      }
    }
  }
  return size;
}

function calcLegacyCourseContentTotals(
  sections,
  { classifyBackupByExtension = true } = {}
) {
  let content = 0;
  let backup = 0;
  let assignments = 0;
  let forums = 0;
  const seenFiles = new Set();

  function addFileToBucket(file, bucket = 'content') {
    if (!file || typeof file !== 'object') return;
    if (file.isdir) return;
    if (file.type && file.type !== 'file') return;

    const fileSize = Number(file.filesize || 0);
    if (fileSize <= 0) return;

    const filename = typeof file.filename === 'string' ? file.filename : '';
    const fileKey = [
      file.fileurl || '',
      file.filepath || '',
      filename,
      file.id || '',
      fileSize,
    ].join('|');

    if (seenFiles.has(fileKey)) return;
    seenFiles.add(fileKey);

    if (classifyBackupByExtension && isBackupFile(filename)) {
      backup += fileSize;
      return;
    }

    if (bucket === 'assignments') {
      assignments += fileSize;
      return;
    }

    if (bucket === 'forums') {
      forums += fileSize;
      return;
    }

    content += fileSize;
  }

  function scanNestedFiles(value, bucket = 'content') {
    if (!value) return;

    if (Array.isArray(value)) {
      for (const item of value) {
        scanNestedFiles(item, bucket);
      }
      return;
    }

    if (typeof value !== 'object') return;

    const looksLikeFile =
      Number(value.filesize || 0) > 0 &&
      !value.isdir &&
      (
        typeof value.filename === 'string' ||
        typeof value.fileurl === 'string' ||
        value.type === 'file'
      );

    if (looksLikeFile) {
      addFileToBucket(value, bucket);
      return;
    }

    for (const nestedValue of Object.values(value)) {
      scanNestedFiles(nestedValue, bucket);
    }
  }

  function resolveModuleBucket(mod = {}) {
    const modName = String(mod?.modname || '').toLowerCase();
    if (modName === 'assign') return 'assignments';
    if (modName === 'forum') return 'forums';
    return 'content';
  }

  for (const section of sections || []) {
    scanNestedFiles(section.summaryfiles, 'content');

    if (!section.modules) continue;
    for (const mod of section.modules) {
      scanNestedFiles(mod, resolveModuleBucket(mod));
    }
  }

  return { content, backup, assignments, forums };
}

function normalizeFileBrowserParams(params = {}) {
  return {
    contextid: params.contextid ?? -1,
    component: typeof params.component === 'string' ? params.component : '',
    filearea: typeof params.filearea === 'string' ? params.filearea : '',
    itemid:
      params.itemid === null || params.itemid === undefined
        ? 0
        : Number(params.itemid),
    filepath: typeof params.filepath === 'string' ? params.filepath : '/',
    filename: typeof params.filename === 'string' ? params.filename : '',
    contextlevel:
      typeof params.contextlevel === 'string' ? params.contextlevel : null,
    instanceid:
      params.instanceid === null || params.instanceid === undefined
        ? null
        : Number(params.instanceid),
  };
}

function buildFileBrowserKey(params = {}) {
  const normalized = normalizeFileBrowserParams(params);
  return [
    normalized.contextid,
    normalized.component,
    normalized.filearea,
    normalized.itemid,
    normalized.filepath,
    normalized.filename,
    normalized.contextlevel ?? '',
    normalized.instanceid ?? '',
  ].join('|');
}

function addBreakdownBytes(breakdownMap, component = '', filearea = '', sizeBytes = 0) {
  const bytes = Number(sizeBytes || 0);
  if (bytes <= 0) return;
  const key = `${component}||${filearea}`;
  if (!breakdownMap[key]) {
    breakdownMap[key] = {
      component,
      filearea,
      size_bytes: 0,
    };
  }
  breakdownMap[key].size_bytes += bytes;
}

function isAssignmentComponent(component = '') {
  return (
    component === 'mod_assign' ||
    component.startsWith('assignsubmission_') ||
    component.startsWith('assignfeedback_')
  );
}

function isContentExcludedComponent(component = '') {
  return component === 'backup' || component === 'mod_forum' || isAssignmentComponent(component);
}

function deriveCourseSizeTotals(storageBreakdown = []) {
  let content = 0;
  let backup = 0;
  let assignments = 0;
  let forums = 0;

  for (const row of storageBreakdown) {
    const bytes = Number(row?.size_bytes || 0);
    if (bytes <= 0) continue;

    if (row.component === 'backup') {
      backup += bytes;
    } else if (row.component === 'mod_forum') {
      forums += bytes;
    } else if (isAssignmentComponent(row.component)) {
      assignments += bytes;
    } else {
      content += bytes;
    }
  }

  return { content, backup, assignments, forums };
}

async function getFileBrowserListings(client, node = {}, visitedListings = new Set()) {
  const base = normalizeFileBrowserParams(node);
  const seenVariants = new Set();
  const results = [];

  async function tryFetch(variant) {
    const variantKey = buildFileBrowserKey(variant);
    if (seenVariants.has(variantKey) || visitedListings.has(variantKey)) {
      return null;
    }

    seenVariants.add(variantKey);
    visitedListings.add(variantKey);

    try {
      const listing = await client.getFiles(variant);
      return { params: variant, listing };
    } catch {
      return null;
    }
  }

  const primary = await tryFetch(base);
  if (primary) {
    results.push(primary);
  }

  if (base.filename) {
    const fallback = {
      ...base,
      filename: '',
    };

    if (!primary || !(primary.listing?.files || []).length) {
      const secondary = await tryFetch(fallback);
      if (secondary) {
        results.push(secondary);
      }
    }
  }

  return results;
}

async function buildCourseStorageBreakdown(
  client,
  courseId,
  { directoryConcurrency = 4 } = {}
) {
  const breakdownMap = {};
  const visitedListings = new Set();
  const seenFiles = new Set();
  const safeDirectoryConcurrency = Math.max(
    1,
    Number.isFinite(Number(directoryConcurrency))
      ? Number(directoryConcurrency)
      : 1
  );
  const pendingDirectories = [{
    contextid: -1,
    component: '',
    filearea: '',
    itemid: 0,
    filepath: '/',
    filename: '',
    contextlevel: 'course',
    instanceid: courseId,
  }];

  while (pendingDirectories.length > 0) {
    const currentBatch = pendingDirectories.splice(0, safeDirectoryConcurrency);
    const listingBatches = await Promise.all(
      currentBatch.map((node) => getFileBrowserListings(client, node, visitedListings))
    );

    for (const listings of listingBatches) {
      for (const { listing } of listings) {
        for (const child of listing.files || []) {
          if (child.isdir) {
            pendingDirectories.push(child);
            continue;
          }

          const fileKey = [
            child.contextid ?? '',
            child.component ?? '',
            child.filearea ?? '',
            child.itemid ?? '',
            child.filepath ?? '',
            child.filename ?? '',
            child.filesize ?? 0,
          ].join('|');

          if (seenFiles.has(fileKey)) continue;
          seenFiles.add(fileKey);

          addBreakdownBytes(
            breakdownMap,
            child.component || '',
            child.filearea || '',
            child.filesize || 0
          );
        }
      }
    }
  }

  return Object.values(breakdownMap)
    .filter((row) => Number(row.size_bytes || 0) > 0)
    .sort((a, b) => b.size_bytes - a.size_bytes);
}

async function getCourseContentSizeFromFileBrowser(client, courseId) {
  const visitedListings = new Set();
  const seenFiles = new Set();
  let total = 0;

  async function walk(node) {
    const listings = await getFileBrowserListings(client, node, visitedListings);
    for (const { listing } of listings) {
      for (const child of listing.files || []) {
        const component = child.component || '';

        if (isContentExcludedComponent(component)) {
          continue;
        }

        if (child.isdir) {
          await walk(child);
          continue;
        }

        const fileKey = [
          child.contextid ?? '',
          component,
          child.filearea ?? '',
          child.itemid ?? '',
          child.filepath ?? '',
          child.filename ?? '',
          child.filesize ?? 0,
        ].join('|');

        if (seenFiles.has(fileKey)) continue;
        seenFiles.add(fileKey);

        total += Number(child.filesize || 0);
      }
    }
  }

  await walk({
    contextid: -1,
    component: '',
    filearea: '',
    itemid: 0,
    filepath: '/',
    filename: '',
    contextlevel: 'course',
    instanceid: courseId,
  });

  return total;
}

async function detectFileBrowserAvailability(client, courseIds = []) {
  const sampleCourseId = courseIds.find((courseId) => Number.isFinite(courseId) && courseId > 0);
  if (!sampleCourseId) {
    return false;
  }

  try {
    await client.getFiles({
      contextid: -1,
      component: '',
      filearea: '',
      itemid: 0,
      filepath: '/',
      filename: '',
      contextlevel: 'course',
      instanceid: sampleCourseId,
    });
    return true;
  } catch (err) {
    console.warn(
      `  ⚠ core_files_get_files not available for course tree scanning: ${err.message}`
    );
    console.warn(
      '  ⚠ Falling back to legacy content/assignment/forum calculation.'
    );
    return false;
  }
}

async function sumFileTree(client, node = {}, visitedListings = new Set(), seenFiles = new Set()) {
  let total = 0;
  const listings = await getFileBrowserListings(client, node, visitedListings);

  for (const { listing } of listings) {
    for (const child of listing.files || []) {
      if (child.isdir) {
        total += await sumFileTree(client, child, visitedListings, seenFiles);
        continue;
      }

      const fileKey = [
        child.contextid ?? '',
        child.component ?? '',
        child.filearea ?? '',
        child.itemid ?? '',
        child.filepath ?? '',
        child.filename ?? '',
        child.filesize ?? 0,
      ].join('|');

      if (seenFiles.has(fileKey)) continue;
      seenFiles.add(fileKey);

      total += Number(child.filesize || 0);
    }
  }

  return total;
}

async function getCourseBackupSize(client, courseId) {
  const roots = [
    {
      contextid: -1,
      component: 'backup',
      filearea: 'course',
      itemid: 0,
      filepath: '/',
      filename: '',
      contextlevel: 'course',
      instanceid: courseId,
    },
    {
      contextid: -1,
      component: 'backup',
      filearea: 'section',
      itemid: 0,
      filepath: '/',
      filename: '',
      contextlevel: 'course',
      instanceid: courseId,
    },
  ];

  let total = 0;
  const visitedListings = new Set();
  const seenFiles = new Set();

  for (const root of roots) {
    total += await sumFileTree(client, root, visitedListings, seenFiles);
  }

  return total;
}

async function detectBackupWsAvailability(client, courseIds = []) {
  const sampleCourseId = courseIds.find((courseId) => Number.isFinite(courseId) && courseId > 0);
  if (!sampleCourseId) {
    return false;
  }

  try {
    await client.getFiles({
      contextid: -1,
      component: 'backup',
      filearea: 'course',
      itemid: 0,
      filepath: '/',
      filename: '',
      contextlevel: 'course',
      instanceid: sampleCourseId,
    });
    return true;
  } catch (err) {
    console.warn(
      `  ⚠ core_files_get_files not available for Moodle backup scan: ${err.message}`
    );
    console.warn(
      '  ⚠ Falling back to legacy .mbz detection in submissions/forums.'
    );
    return false;
  }
}

function upsertUserAccumulator(userSizeMap, userId, partialUser = {}) {
  const key = String(userId);
  const fallbackUsername = partialUser.username || `user-${key}`;
  const fallbackFullname = partialUser.fullname || fallbackUsername || `Usuario ${key}`;

  if (!userSizeMap[key]) {
    userSizeMap[key] = {
      username: fallbackUsername,
      fullname: fallbackFullname,
      totalBytes: 0,
    };
    return userSizeMap[key];
  }

  if (partialUser.username && userSizeMap[key].username.startsWith('user-')) {
    userSizeMap[key].username = partialUser.username;
  }

  if (
    partialUser.fullname &&
    (!userSizeMap[key].fullname ||
      userSizeMap[key].fullname === userSizeMap[key].username ||
      userSizeMap[key].fullname.startsWith('user-') ||
      userSizeMap[key].fullname.startsWith('Usuario '))
  ) {
    userSizeMap[key].fullname = partialUser.fullname;
  }

  return userSizeMap[key];
}

const CONCURRENCY = 5;
const CHUNK = 50;

/* ─── Per-platform sync ─── */

async function syncPlatform(platform, syncLog) {
  const client = new MoodleClient(platform.url, platform.token);
  const source = platform.url;
  const moodleName = platform.name;

  // ═══════════════════════════════════════════════════════
  // STEP 1+2: Fetch categories AND courses in parallel
  // ═══════════════════════════════════════════════════════
  const [categoriesRaw, coursesRaw] = await Promise.all([
    client.getCategories(),
    client.getCourses(),
  ]);

  // Defensive: Moodle may return an error object instead of an array
  if (!Array.isArray(coursesRaw)) {
    console.error('  ⚠ getCourses returned non-array:', JSON.stringify(coursesRaw).substring(0, 300));
    throw new Error('getCourses did not return an array — check token permissions');
  }
  const categories = Array.isArray(categoriesRaw) ? categoriesRaw : [];
  const courses = coursesRaw;

  const catMap = {};
  for (const cat of categories) {
    catMap[cat.id] = cat.name;
  }

  const courseIds = courses.map((c) => c.id);
  const backupWsAvailable = await detectBackupWsAvailability(client, courseIds);

  // Build courseId → course metadata map for quick lookup
  const courseMetaMap = {};
  for (const course of courses) {
    courseMetaMap[course.id] = {
      course_name: course.fullname,
      shortname: course.shortname || '',
      category_id: course.categoryid ?? 0,
      category_name: catMap[course.categoryid] || 'Sin categoría',
    };
  }

  // Per-course size accumulators
  const courseSizes = {}; // courseId → { content, backup, assignments, forums, storageBreakdown }
  const courseUsesLegacy = {};
  for (const id of courseIds) {
    courseSizes[id] = {
      content: 0,
      backup: 0,
      assignments: 0,
      forums: 0,
      storageBreakdown: [],
    };
    courseUsesLegacy[id] = true;
  }

  // ═══════════════════════════════════════════════════════
  // STEP 3: Enhanced course content sizes
  // ═══════════════════════════════════════════════════════
  const CONTENT_CONCURRENCY = 10;
  console.log(
    `  [1/6] Calculating enhanced course content sizes... (${courses.length} courses, ${CONTENT_CONCURRENCY} parallel)`
  );
  for (let i = 0; i < courses.length; i += CONTENT_CONCURRENCY) {
    const batch = courses.slice(i, i + CONTENT_CONCURRENCY);
    console.log(
      `    - Content: courses ${i + 1} to ${Math.min(i + CONTENT_CONCURRENCY, courses.length)}...`
    );
    await Promise.all(
      batch.map(async (course) => {
        try {
          const sections = await client.getCourseContents(course.id);
          const legacyTotals = calcLegacyCourseContentTotals(sections, {
            classifyBackupByExtension: !backupWsAvailable,
          });
          courseSizes[course.id].content = legacyTotals.content;
          courseSizes[course.id].backup = legacyTotals.backup;
          courseSizes[course.id].assignments = legacyTotals.assignments;
          courseSizes[course.id].forums = legacyTotals.forums;
        } catch (err) {
          console.error(
            `  ⚠ Error content course ${course.id} (${course.shortname || course.fullname || 'sin nombre'}):`,
            err.message
          );
        }
      })
    );
  }

  // ═══════════════════════════════════════════════════════
  // STEP 4: Moodle backup sizes from backup-only tree scan
  // ═══════════════════════════════════════════════════════
  if (backupWsAvailable) {
    const BACKUP_CONCURRENCY = 10;
    console.log(
      `  [2/6] Calculating Moodle backup sizes... (${courses.length} courses, ${BACKUP_CONCURRENCY} parallel)`
    );
    for (let i = 0; i < courses.length; i += BACKUP_CONCURRENCY) {
      const batch = courses.slice(i, i + BACKUP_CONCURRENCY);
      console.log(
        `    - Backups: courses ${i + 1} to ${Math.min(i + BACKUP_CONCURRENCY, courses.length)}...`
      );
      await Promise.all(
        batch.map(async (course) => {
          try {
            courseSizes[course.id].backup += await getCourseBackupSize(client, course.id);
          } catch (err) {
            console.warn(
              `  ⚠ Error backup scan course ${course.id} (${course.shortname || course.fullname || 'sin nombre'}): ${err.message}`
            );
          }
        })
      );
    }
  } else {
    console.log('  [2/6] Skipping Moodle backup scan; using legacy .mbz fallback.');
  }

  // ═══════════════════════════════════════════════════════
  // STEP 5: Assignment submission sizes (per-user and legacy per-course fallback)
  // ═══════════════════════════════════════════════════════
  console.log(`  [3/6] Fetching enrolled users for top users...`);

  const userSizeMap = {}; // userId → { username, fullname, totalBytes }

  // 4a. Get enrolled users per course (higher concurrency — read-only calls)
  const ENROL_CONCURRENCY = 10;
  console.log(`    - Enrolled users: ${courses.length} courses, ${ENROL_CONCURRENCY} parallel`);
  for (let i = 0; i < courses.length; i += ENROL_CONCURRENCY) {
    const batch = courses.slice(i, i + ENROL_CONCURRENCY);
    console.log(`      Enrolled users: courses ${i + 1} to ${Math.min(i + ENROL_CONCURRENCY, courses.length)} of ${courses.length}...`);
    await Promise.all(
      batch.map(async (course) => {
        try {
          const users = await client.getEnrolledUsers(course.id);
          for (const u of users) {
            upsertUserAccumulator(userSizeMap, u.id, {
              username: u.username,
              fullname: `${u.firstname || ''} ${u.lastname || ''}`.trim(),
            });
          }
        } catch (err) {
          console.warn(
            `  ⚠ Error enrolled users course ${course.id} (${course.shortname || course.fullname || 'sin nombre'}): ${err.message}`
          );
        }
      })
    );
  }

  // 4b. Get assignments and submissions — track per-user AND per-course
  console.log(`  [4/6] Calculating assignment submissions and top users...`);

  for (let i = 0; i < courseIds.length; i += CHUNK) {
    try {
      const chunk = courseIds.slice(i, i + CHUNK);
      const assignData = await client.getAssignments(chunk);
      const assignCourses = assignData.courses || [];

      // Build assignmentId → courseId map
      const assignToCourse = {};
      const allAssignIds = [];
      for (const ac of assignCourses) {
        for (const a of ac.assignments || []) {
          assignToCourse[a.id] = ac.id; // ac.id is the course id
          allAssignIds.push(a.id);
        }
      }

      // Fetch submissions in sub-chunks
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

                    const shouldAccumulateCourseSizes =
                      Boolean(courseId) &&
                      Boolean(courseSizes[courseId]) &&
                      Boolean(courseUsesLegacy[courseId]);

                    if (
                      shouldAccumulateCourseSizes &&
                      !backupWsAvailable &&
                      isBackupFile(file.filename)
                    ) {
                      // Count .mbz submissions as backup, not assignment
                      if (courseId && courseSizes[courseId]) {
                        courseSizes[courseId].backup += fileSize;
                      }
                      continue;
                    }
                    // Track per-course only in legacy fallback mode
                    if (shouldAccumulateCourseSizes) {
                      courseSizes[courseId].assignments += fileSize;
                    }

                    // Track per-user
                    upsertUserAccumulator(userSizeMap, userId).totalBytes += fileSize;
                  }
                }
              }
            }
          }
        } catch (err) {
          console.warn(
            `  ⚠ Error submissions chunk ${j + 1}-${Math.min(j + CHUNK, allAssignIds.length)}: ${err.message}`
          );
        }
      }
    } catch (err) {
      console.warn(
        `  ⚠ Error assignments chunk ${i + 1}-${Math.min(i + CHUNK, courseIds.length)}: ${err.message}`
      );
    }
  }

  // ═══════════════════════════════════════════════════════
  // STEP 5: Forum attachment sizes
  // ═══════════════════════════════════════════════════════
  console.log(`  [5/6] Calculating forum attachment sizes...`);

  try {
    for (let i = 0; i < courseIds.length; i += CHUNK) {
      const chunk = courseIds.slice(i, i + CHUNK);

      let forums;
      try {
        forums = await client.getForumsByCourses(chunk);
      } catch (err) {
        console.warn(`    ⚠ Forums WS not available: ${err.message}`);
        console.warn(`    ⚠ Skipping forum sizes. Add mod_forum functions to your WS token.`);
        break;
      }

      if (!Array.isArray(forums)) continue;

      console.log(
        `    - Found ${forums.length} forums in courses ${i + 1}-${Math.min(i + CHUNK, courseIds.length)}`
      );

      const allDiscussions = [];
      const FORUM_CONCURRENCY = 10;

      for (let f = 0; f < forums.length; f += FORUM_CONCURRENCY) {
        const forumBatch = forums.slice(f, f + FORUM_CONCURRENCY);
        await Promise.all(
          forumBatch.map(async (forum) => {
            try {
              const discResult = await client.getForumDiscussions(forum.id);
              const discussions = discResult.discussions || [];
              for (const disc of discussions) {
                allDiscussions.push({
                  courseId: forum.course,
                  discussionId: disc.discussion,
                });
              }
            } catch {
              // Skip forum errors
            }
          })
        );
      }

      console.log(`    - Scanning ${allDiscussions.length} discussions for attachments...`);

      for (let d = 0; d < allDiscussions.length; d += FORUM_CONCURRENCY) {
        const discBatch = allDiscussions.slice(d, d + FORUM_CONCURRENCY);
        await Promise.all(
          discBatch.map(async ({ courseId, discussionId }) => {
            try {
              const postResult = await client.getDiscussionPosts(discussionId);
              const posts = postResult.posts || [];

              for (const post of posts) {
                if (post.attachments && Array.isArray(post.attachments)) {
                  for (const att of post.attachments) {
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

                if (post.messageinlinefiles && Array.isArray(post.messageinlinefiles)) {
                  for (const att of post.messageinlinefiles) {
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
              // Skip individual discussion errors
            }
          })
        );
      }
    }
  } catch (err) {
    console.warn(`  ⚠ Forum scanning failed: ${err.message}`);
  }

  // ═══════════════════════════════════════════════════════
  // STEP 7: Persist everything to MongoDB (bulk operations)
  // ═══════════════════════════════════════════════════════
  console.log(`  [6/6] Saving data to database...`);
  const now = new Date();

  // 6a. Bulk upsert courses
  const courseOps = courseIds
    .filter((id) => courseMetaMap[id])
    .map((courseId) => {
      const meta = courseMetaMap[courseId];
      const sizes = courseSizes[courseId];
      return {
        updateOne: {
          filter: { moodle_source: source, course_id: courseId },
          update: {
            $set: {
              moodle_source: source,
              moodle_name: moodleName,
              course_id: courseId,
              course_name: meta.course_name,
              shortname: meta.shortname,
              category_id: meta.category_id,
              category_name: meta.category_name,
              size_bytes: sizes.content,
              backup_size_bytes: sizes.backup,
              assignment_size_bytes: sizes.assignments,
              forum_size_bytes: sizes.forums,
              storage_breakdown: sizes.storageBreakdown,
              synced_at: now,
            },
          },
          upsert: true,
        },
      };
    });

  if (courseOps.length > 0) {
    try {
      await Course.bulkWrite(courseOps, { ordered: false });
    } catch (err) {
      console.error(`  ⚠ Error bulk saving courses: ${err.message}`);
    }
  }

  // 6b. Bulk upsert users
  const userIds = Object.keys(userSizeMap);
  const userOps = userIds.map((uid) => {
    const u = userSizeMap[uid];
    return {
      updateOne: {
        filter: { moodle_source: source, user_id: Number(uid) },
        update: {
          $set: {
            moodle_source: source,
            moodle_name: moodleName,
            user_id: Number(uid),
            username: u.username,
            fullname: u.fullname,
            total_size_bytes: u.totalBytes,
            synced_at: now,
          },
        },
        upsert: true,
      },
    };
  });

  if (userOps.length > 0) {
    try {
      await User.bulkWrite(userOps, { ordered: false });
    } catch (err) {
      console.error(`  ⚠ Error bulk saving users: ${err.message}`);
    }
  }


  const totalBytes = Object.values(courseSizes).reduce(
    (acc, sizes) =>
      acc +
      (sizes.content || 0) +
      (sizes.backup || 0) +
      (sizes.assignments || 0) +
      (sizes.forums || 0),
    0
  );
  const financial = calculateFinancialMetrics(totalBytes, platform);
  const month = getMonthKey(now);

  try {
    await PlatformSnapshot.findOneAndUpdate(
      { moodle_source: source, month },
      {
        $set: {
          moodle_source: source,
          moodle_name: moodleName,
          month,
          total_bytes: totalBytes,
          monthly_charge: financial.monthlyCharge,
          cost_per_gb: financial.costPerGb,
          currency: financial.currency,
          income: financial.income,
          cost: financial.cost,
          margin: financial.margin,
          synced_at: now,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
  } catch (err) {
    console.warn(`  ⚠ Error saving platform snapshot: ${err.message}`);
  }

  console.log(`  ✔ Saved ${courseOps.length} courses, ${userOps.length} users`);
  return { courses: courses.length, users: userIds.length, totalBytes };
}

/* ─── Main sync entry point ─── */

async function runFullSync() {
  const platforms = readPlatformConfig().filter(isPlatformActive);

  const syncLog = await SyncLog.create({
    platforms_total: platforms.length,
    platforms_synced: 0,
    status: 'running',
  });

  currentProgress = {
    id: syncLog._id,
    status: 'running',
    started_at: syncLog.started_at,
    completed_at: null,
    platforms_total: platforms.length,
    platforms_synced: 0,
    current_platform: '',
    sync_errors: [],
  };

  try {
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      currentProgress.current_platform = p.name;
      console.log(`▶ Syncing [${i + 1}/${platforms.length}]: ${p.name}`);

      try {
        const result = await syncPlatform(p, syncLog);
        console.log(
          `  ✓ ${p.name}: ${result.courses} courses, ${result.users} users`
        );
      } catch (err) {
        const msg = `${p.name}: ${err.message}`;
        console.error(`  ✗ ${msg}`);
        currentProgress.sync_errors.push(msg);
        syncLog.sync_errors.push(msg);
      }

      currentProgress.platforms_synced = i + 1;
      syncLog.platforms_synced = i + 1;
      await syncLog.save();
    }

    syncLog.status = 'completed';
    syncLog.completed_at = new Date();
    await syncLog.save();

    currentProgress.status = 'completed';
    currentProgress.completed_at = syncLog.completed_at;
  } catch (err) {
    syncLog.status = 'failed';
    syncLog.sync_errors.push(err.message);
    syncLog.completed_at = new Date();
    await syncLog.save();

    currentProgress.status = 'failed';
    currentProgress.completed_at = syncLog.completed_at;
    currentProgress.sync_errors.push(err.message);
  }

  return currentProgress;
}

module.exports = {
  runFullSync,
  getProgress,
  buildCourseStorageBreakdown,
  deriveCourseSizeTotals,
  detectFileBrowserAvailability,
};
