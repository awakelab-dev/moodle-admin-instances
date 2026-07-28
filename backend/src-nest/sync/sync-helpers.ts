const BACKUP_EXTENSIONS = ['.mbz'];

export function isBackupFile(filename?: string): boolean {
  if (!filename) return false;
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return false;
  const ext = filename.substring(dotIndex).toLowerCase();
  return BACKUP_EXTENSIONS.includes(ext);
}

export function calcLegacyCourseContentTotals(sections: any[], { classifyBackupByExtension = true } = {}) {
  let content = 0;
  let backup = 0;
  let assignments = 0;
  let forums = 0;
  const seenFiles = new Set<string>();

  function addFileToBucket(file: any, bucket = 'content') {
    if (!file || typeof file !== 'object') return;
    if (file.isdir) return;
    if (file.type && file.type !== 'file') return;

    const fileSize = Number(file.filesize || 0);
    if (fileSize <= 0) return;

    const filename = typeof file.filename === 'string' ? file.filename : '';
    const fileKey = [file.fileurl || '', file.filepath || '', filename, file.id || '', fileSize].join('|');

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

  function scanNestedFiles(value: any, bucket = 'content') {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) scanNestedFiles(item, bucket);
      return;
    }
    if (typeof value !== 'object') return;

    const looksLikeFile =
      Number(value.filesize || 0) > 0 &&
      !value.isdir &&
      (typeof value.filename === 'string' || typeof value.fileurl === 'string' || value.type === 'file');

    if (looksLikeFile) {
      addFileToBucket(value, bucket);
      return;
    }
    for (const nestedValue of Object.values(value)) {
      scanNestedFiles(nestedValue, bucket);
    }
  }

  function resolveModuleBucket(mod: any = {}) {
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

function normalizeFileBrowserParams(params: any = {}) {
  return {
    contextid: params.contextid ?? -1,
    component: typeof params.component === 'string' ? params.component : '',
    filearea: typeof params.filearea === 'string' ? params.filearea : '',
    itemid: params.itemid === null || params.itemid === undefined ? 0 : Number(params.itemid),
    filepath: typeof params.filepath === 'string' ? params.filepath : '/',
    filename: typeof params.filename === 'string' ? params.filename : '',
    contextlevel: typeof params.contextlevel === 'string' ? params.contextlevel : null,
    instanceid: params.instanceid === null || params.instanceid === undefined ? null : Number(params.instanceid),
  };
}

function buildFileBrowserKey(params: any = {}) {
  const n = normalizeFileBrowserParams(params);
  return [n.contextid, n.component, n.filearea, n.itemid, n.filepath, n.filename, n.contextlevel ?? '', n.instanceid ?? ''].join('|');
}

export function addBreakdownBytes(breakdownMap: Record<string, any>, component = '', filearea = '', sizeBytes = 0) {
  const bytes = Number(sizeBytes || 0);
  if (bytes <= 0) return;
  const key = `${component}||${filearea}`;
  if (!breakdownMap[key]) {
    breakdownMap[key] = { component, filearea, size_bytes: 0 };
  }
  breakdownMap[key].size_bytes += bytes;
}

export function isAssignmentComponent(component = ''): boolean {
  return component === 'mod_assign' || component.startsWith('assignsubmission_') || component.startsWith('assignfeedback_');
}

function isContentExcludedComponent(component = ''): boolean {
  return component === 'backup' || component === 'mod_forum' || isAssignmentComponent(component);
}

export function deriveCourseSizeTotals(storageBreakdown: any[] = []) {
  let content = 0;
  let backup = 0;
  let assignments = 0;
  let forums = 0;

  for (const row of storageBreakdown) {
    const bytes = Number(row?.size_bytes || 0);
    if (bytes <= 0) continue;
    if (row.component === 'backup') backup += bytes;
    else if (row.component === 'mod_forum') forums += bytes;
    else if (isAssignmentComponent(row.component)) assignments += bytes;
    else content += bytes;
  }

  return { content, backup, assignments, forums };
}

async function getFileBrowserListings(client: any, node: any = {}, visitedListings: Set<string>) {
  const base = normalizeFileBrowserParams(node);
  const seenVariants = new Set<string>();
  const results: any[] = [];

  async function tryFetch(variant: any) {
    const variantKey = buildFileBrowserKey(variant);
    if (seenVariants.has(variantKey) || visitedListings.has(variantKey)) return null;
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
  if (primary) results.push(primary);

  if (base.filename) {
    const fallback = { ...base, filename: '' };
    if (!primary || !(primary.listing?.files || []).length) {
      const secondary = await tryFetch(fallback);
      if (secondary) results.push(secondary);
    }
  }

  return results;
}

export async function buildCourseStorageBreakdown(client: any, courseId: number, { directoryConcurrency = 4 } = {}) {
  const breakdownMap: Record<string, any> = {};
  const visitedListings = new Set<string>();
  const seenFiles = new Set<string>();
  const safeDirectoryConcurrency = Math.max(1, Number.isFinite(Number(directoryConcurrency)) ? Number(directoryConcurrency) : 1);
  const pendingDirectories: any[] = [
    { contextid: -1, component: '', filearea: '', itemid: 0, filepath: '/', filename: '', contextlevel: 'course', instanceid: courseId },
  ];

  while (pendingDirectories.length > 0) {
    const currentBatch = pendingDirectories.splice(0, safeDirectoryConcurrency);
    const listingBatches = await Promise.all(currentBatch.map((node) => getFileBrowserListings(client, node, visitedListings)));

    for (const listings of listingBatches) {
      for (const { listing } of listings) {
        for (const child of listing.files || []) {
          if (child.isdir) {
            pendingDirectories.push(child);
            continue;
          }
          const fileKey = [child.contextid ?? '', child.component ?? '', child.filearea ?? '', child.itemid ?? '', child.filepath ?? '', child.filename ?? '', child.filesize ?? 0].join('|');
          if (seenFiles.has(fileKey)) continue;
          seenFiles.add(fileKey);
          addBreakdownBytes(breakdownMap, child.component || '', child.filearea || '', child.filesize || 0);
        }
      }
    }
  }

  return Object.values(breakdownMap)
    .filter((row: any) => Number(row.size_bytes || 0) > 0)
    .sort((a: any, b: any) => b.size_bytes - a.size_bytes);
}

export async function detectFileBrowserAvailability(client: any, courseIds: number[] = []): Promise<boolean> {
  const sampleCourseId = courseIds.find((id) => Number.isFinite(id) && id > 0);
  if (!sampleCourseId) return false;
  try {
    await client.getFiles({ contextid: -1, component: '', filearea: '', itemid: 0, filepath: '/', filename: '', contextlevel: 'course', instanceid: sampleCourseId });
    return true;
  } catch (err: any) {
    console.warn(`  ⚠ core_files_get_files not available for course tree scanning: ${err.message}`);
    return false;
  }
}

async function sumFileTree(client: any, node: any = {}, visitedListings: Set<string>, seenFiles: Set<string>): Promise<number> {
  let total = 0;
  const listings = await getFileBrowserListings(client, node, visitedListings);

  for (const { listing } of listings) {
    for (const child of listing.files || []) {
      if (child.isdir) {
        total += await sumFileTree(client, child, visitedListings, seenFiles);
        continue;
      }
      const fileKey = [child.contextid ?? '', child.component ?? '', child.filearea ?? '', child.itemid ?? '', child.filepath ?? '', child.filename ?? '', child.filesize ?? 0].join('|');
      if (seenFiles.has(fileKey)) continue;
      seenFiles.add(fileKey);
      total += Number(child.filesize || 0);
    }
  }
  return total;
}

export async function getCourseBackupSize(client: any, courseId: number): Promise<number> {
  const roots = [
    { contextid: -1, component: 'backup', filearea: 'course', itemid: 0, filepath: '/', filename: '', contextlevel: 'course', instanceid: courseId },
    { contextid: -1, component: 'backup', filearea: 'section', itemid: 0, filepath: '/', filename: '', contextlevel: 'course', instanceid: courseId },
  ];
  let total = 0;
  const visitedListings = new Set<string>();
  const seenFiles = new Set<string>();
  for (const root of roots) {
    total += await sumFileTree(client, root, visitedListings, seenFiles);
  }
  return total;
}

export async function detectBackupWsAvailability(client: any, courseIds: number[] = []): Promise<boolean> {
  const sampleCourseId = courseIds.find((id) => Number.isFinite(id) && id > 0);
  if (!sampleCourseId) return false;
  try {
    await client.getFiles({ contextid: -1, component: 'backup', filearea: 'course', itemid: 0, filepath: '/', filename: '', contextlevel: 'course', instanceid: sampleCourseId });
    return true;
  } catch (err: any) {
    console.warn(`  ⚠ core_files_get_files not available for Moodle backup scan: ${err.message}`);
    return false;
  }
}

export function upsertUserAccumulator(userSizeMap: Record<string, any>, userId: number | string, partialUser: any = {}) {
  const key = String(userId);
  const fallbackUsername = partialUser.username || `user-${key}`;
  const fallbackFullname = partialUser.fullname || fallbackUsername || `Usuario ${key}`;

  if (!userSizeMap[key]) {
    userSizeMap[key] = {
      username: fallbackUsername,
      fullname: fallbackFullname,
      email: partialUser.email || '',
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
  if (partialUser.email && !userSizeMap[key].email) {
    userSizeMap[key].email = partialUser.email;
  }
  return userSizeMap[key];
}
