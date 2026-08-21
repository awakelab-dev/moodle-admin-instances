// .mbz es la extensión de los archivos de copia de seguridad (backup) de Moodle.
const BACKUP_EXTENSIONS = ['.mbz'];

// Moodle devuelve varios campos "formatted" (nota, feedback, porcentaje) ya
// renderizados como HTML (p. ej. envueltos en <span>, con &nbsp;). Como se
// muestran como texto plano en tablas, se limpian las etiquetas y entidades
// antes de exponerlos.
export function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

// El "gradeformatted" del ítem de tipo "course" (nota total) a veces trae,
// tras quitar el HTML, una coletilla de si se ha superado el curso, del
// tipo "6,33 (Superar (S))" — se recorta para dejar solo el número.
export function stripGradeAnnotation(value: string): string {
  return value.replace(/\s*\(.*$/, '').trim();
}

// Cada ítem de Moodle puede tener su propia nota máxima (grademax) —
// algunas actividades están configuradas sobre 10, otras sobre 100, etc.
// Se normaliza a una nota sobre 10 para que todos los ítems se puedan
// comparar entre sí, en vez de mezclar escalas distintas.
export function formatScoreOutOf10(graderaw: unknown, grademax: unknown): string {
  const raw = typeof graderaw === 'number' ? graderaw : Number(graderaw);
  const max = typeof grademax === 'number' ? grademax : Number(grademax);
  if (!Number.isFinite(raw) || !Number.isFinite(max) || max <= 0) return '—';
  return ((raw / max) * 10).toFixed(2).replace('.', ',');
}

/** Determina si un archivo es una copia de seguridad de Moodle por su extensión. */
export function isBackupFile(filename?: string): boolean {
  if (!filename) return false;
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return false;
  const ext = filename.substring(dotIndex).toLowerCase();
  return BACKUP_EXTENSIONS.includes(ext);
}

/**
 * Recorre las secciones/módulos devueltos por core_course_get_contents y suma
 * el tamaño de los archivos encontrados, repartiéndolos en 4 buckets: content,
 * backup, assignments y forums. Es el método "legado" de medir tamaños (sin
 * depender de core_files_get_files ni de wsfunctions específicas de tareas/
 * foros), por eso el nombre "Legacy": sirve de respaldo cuando esas otras
 * wsfunctions no están disponibles en la plataforma Moodle.
 * classifyBackupByExtension=false cuando ya se cuenta el backup por otra vía
 * (detectBackupWsAvailability), para no duplicar el tamaño de esos archivos.
 */
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

  // core_course_get_contents no tiene una estructura fija de dónde vienen los
  // archivos dentro de cada módulo (depende del tipo de actividad), así que
  // se recorre recursivamente todo el objeto buscando algo con forma de archivo
  // en lugar de asumir una ruta fija como mod.contents[].
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

  // Solo assign y forum tienen bucket propio; el resto de tipos de módulo
  // (recursos, páginas, etc.) cae en "content".
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

// Rellena con los defaults que espera core_files_get_files (contextid -1,
// filepath '/', etc.) para poder comparar/deduplicar nodos del árbol de
// archivos de forma consistente aunque venga un objeto parcial.
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

/** Clave única de un nodo del explorador de archivos, usada para no volver a pedir el mismo listado dos veces. */
function buildFileBrowserKey(params: any = {}) {
  const n = normalizeFileBrowserParams(params);
  return [n.contextid, n.component, n.filearea, n.itemid, n.filepath, n.filename, n.contextlevel ?? '', n.instanceid ?? ''].join('|');
}

/** Acumula bytes en el mapa de desglose de almacenamiento, agrupando por par (component, filearea) de Moodle. */
export function addBreakdownBytes(breakdownMap: Record<string, any>, component = '', filearea = '', sizeBytes = 0) {
  const bytes = Number(sizeBytes || 0);
  if (bytes <= 0) return;
  const key = `${component}||${filearea}`;
  if (!breakdownMap[key]) {
    breakdownMap[key] = { component, filearea, size_bytes: 0 };
  }
  breakdownMap[key].size_bytes += bytes;
}

/** Un componente de Moodle cuenta como "de tareas" si es el propio mod_assign o cualquier plugin de entrega/feedback de tareas. */
export function isAssignmentComponent(component = ''): boolean {
  return component === 'mod_assign' || component.startsWith('assignsubmission_') || component.startsWith('assignfeedback_');
}

// No se usa actualmente (deriveCourseSizeTotals hace la misma exclusión en línea),
// se deja como utilidad auxiliar documentando qué componentes no cuentan como "content".
function isContentExcludedComponent(component = ''): boolean {
  return component === 'backup' || component === 'mod_forum' || isAssignmentComponent(component);
}

/**
 * A partir del desglose de almacenamiento por componente (obtenido vía
 * buildCourseStorageBreakdown/core_files_get_files), agrupa los bytes en los
 * mismos 4 buckets que calcLegacyCourseContentTotals (content/backup/
 * assignments/forums), pero basándose en el "component" que reporta Moodle
 * en vez de en la extensión del archivo.
 */
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

/**
 * Pide el listado de un nodo del explorador de archivos (core_files_get_files)
 * y, si el nodo pedía un filename concreto y no devolvió nada, reintenta sin
 * filename (listado de la carpeta completa) — algunas plataformas Moodle no
 * responden igual a ambas variantes, así que se cubren las dos. visitedListings
 * evita reprocesar el mismo nodo si ya se visitó en una rama distinta del árbol.
 */
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
      // Nodo no accesible o wsfunction no disponible para esta rama del árbol: se ignora y se sigue.
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

/**
 * Recorre por BFS todo el árbol de archivos de un curso a través de
 * core_files_get_files, empezando por la raíz del curso, y devuelve el
 * desglose de bytes por (component, filearea) ordenado de mayor a menor.
 * directoryConcurrency limita cuántas carpetas se listan en paralelo en cada
 * nivel del árbol, para no saturar el servidor Moodle con requests simultáneas.
 */
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

/**
 * Comprueba, con un curso de muestra, si el token tiene permiso para usar
 * core_files_get_files (el explorador de archivos). No todas las plataformas
 * habilitan esta wsfunction para el rol del token, así que se detecta una vez
 * al principio de la sincronización en vez de fallar curso por curso.
 */
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

/** Suma recursivamente el tamaño de todos los archivos bajo un nodo del explorador de archivos de Moodle. */
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

/**
 * Suma el tamaño de las copias de seguridad de un curso explorando los dos
 * fileareas donde Moodle las guarda: "course" (backups manuales/automáticos
 * a nivel de curso) y "section" (backups por sección). Solo funciona si el
 * token tiene acceso a core_files_get_files (ver detectBackupWsAvailability).
 */
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

/**
 * "backupWsAvailable": indica si el token puede usar core_files_get_files
 * sobre el component 'backup' de un curso de muestra. Se detecta una sola vez
 * al inicio de la sincronización (en vez de por curso) porque es un permiso
 * de la plataforma/token, no del curso concreto; si no está disponible, el
 * tamaño de los backups se estima por extensión de archivo (.mbz) en
 * calcLegacyCourseContentTotals en lugar de escanearlo con getCourseBackupSize.
 */
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

/**
 * "gradesWsAvailable": indica si el token puede usar
 * gradereport_user_get_grade_items (algunas plataformas no habilitan este
 * reporte de calificaciones para el rol del token). Igual que
 * detectBackupWsAvailability, se prueba una sola vez con un curso de muestra
 * y el resultado condiciona si se ejecuta el paso de cálculo de calificaciones
 * para todos los cursos.
 */
export async function detectGradesWsAvailability(client: any, courseIds: number[] = []): Promise<boolean> {
  const sampleCourseId = courseIds.find((id) => Number.isFinite(id) && id > 0);
  if (!sampleCourseId) return false;
  try {
    await client.getGradeItems(sampleCourseId);
    return true;
  } catch (err: any) {
    console.warn(`  ⚠ gradereport_user_get_grade_items not available for grades sync: ${err.message}`);
    return false;
  }
}

/**
 * Extrae el porcentaje de calificación del curso (itemtype 'course') a partir
 * del array gradeitems de un usuario. Prioriza el campo ya formateado por
 * Moodle (percentageformatted, p. ej. "85,50 %") y si no viene calcula el
 * porcentaje manualmente desde graderaw/grademax como respaldo.
 */
export function extractCoursePercentage(gradeItems: any[] = []): number | null {
  const courseItem = Array.isArray(gradeItems)
    ? gradeItems.find((item: any) => item?.itemtype === 'course')
    : null;
  if (!courseItem) return null;

  if (typeof courseItem.percentageformatted === 'string') {
    const parsed = parseFloat(courseItem.percentageformatted.replace('%', '').replace(',', '.').trim());
    if (Number.isFinite(parsed)) return parsed;
  }

  if (Number.isFinite(courseItem.graderaw) && Number.isFinite(courseItem.grademax) && courseItem.grademax > 0) {
    return (Number(courseItem.graderaw) / Number(courseItem.grademax)) * 100;
  }

  return null;
}

/** Devuelve el gradeitem completo del curso (itemtype 'course'), sin reducirlo a porcentaje. */
export function extractCourseGradeItem(gradeItems: any[] = []): any | null {
  return Array.isArray(gradeItems) ? gradeItems.find((item: any) => item?.itemtype === 'course') || null : null;
}

/**
 * Igual que Promise.all pero limitando cuántas promesas de fn() corren en
 * paralelo a la vez (concurrency). Existe porque golpear un Moodle real con
 * cientos de llamadas simultáneas a su Web Service suele saturarlo o disparar
 * límites de rate/timeout del servidor; se procesan en lotes en su lugar.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(fn));
    chunkResults.forEach((result, idx) => {
      results[i + idx] = result;
    });
  }
  return results;
}

/**
 * Obtiene (creando si no existe) la entrada acumuladora de un usuario dentro
 * de userSizeMap, usada para ir sumando bytes de archivos de distintas fuentes
 * (contenidos, tareas, foros) a lo largo de la sincronización. El mismo
 * usuario puede aparecer primero solo con su id (p. ej. desde una entrega,
 * sin datos de perfil) y más tarde con datos completos (desde matriculación),
 * por eso el "upsert": si ya existe una entrada con datos placeholder
 * ("user-<id>" / "Usuario <id>") se reemplaza en cuanto llegan datos reales,
 * pero nunca se sobrescribe un dato real ya guardado con otro placeholder.
 */
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
