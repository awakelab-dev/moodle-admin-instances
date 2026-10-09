// Puerto del "SCORM Lab → Fix" de SCORM-Suite (public/analyzer): detecta y
// corrige los problemas más comunes de paquetes SCORM mal exportados antes
// de subirlos — estructura anidada (imsmanifest.xml no está en la raíz),
// nombres de archivo con caracteres ilegales en Windows, y compresión de
// imágenes pesadas. No cubre el caso de imágenes embebidas como data:URI
// dentro de HTML (SCORM-Suite sí lo hacía) — se dejó fuera para mantener
// esto acotado; si hace falta se puede añadir después.
import sharp from 'sharp';

export interface ScormFile {
  path: string;
  data: Buffer;
}

export interface OptimizeIssue {
  icon: string;
  text: string;
  type: 'cloud' | 'warn' | 'info' | 'ok';
}

export interface OptimizeReport {
  cloudProvider: string | null;
  isNested: boolean;
  hasLaunchMismatch: boolean;
  illegalCharCount: number;
  imagesCompressed: number;
  bytesSaved: number;
  issues: OptimizeIssue[];
}

const COMPRESSIBLE_IMG = new Set(['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'webp', 'avif']);
const IMG_COMPRESS_THRESHOLD = 200 * 1024; // 200 KB — por debajo no compensa recodificar
const ILLEGAL_CHARS = /[<>:"|?*\x00-\x1f]/;

// "proxy-cloud": paquetes que en realidad son un cascarón que redirige a un
// reproductor externo (SCORM Cloud, Agilix, etc.) — no son corregibles
// localmente porque el contenido real no está en el ZIP.
function detectCloudDependency(files: ScormFile[]): string | null {
  const PROXY_SIGNATURES = ['proxy.html', 'redirect.html', 'scorm_wrapper.html'];
  const fileNames = files.map((f) => basename(f.path).toLowerCase());
  const proxyCount = PROXY_SIGNATURES.filter((p) => fileNames.includes(p)).length;
  if (proxyCount < 2) return null;

  const PROXY_FILENAMES = new Set([...PROXY_SIGNATURES, 'config.js']);
  const CLOUD_DOMAINS: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /scormnext|scormproxy\.com|backend\.scormnext\.es/i, label: 'scormNEXT' },
    { pattern: /app\.scorm\.cloud|api\.rustici\.com/i, label: 'SCORM Cloud' },
    { pattern: /agilix\.com|buzz\.agilix\.com/i, label: 'Agilix Buzz' },
    { pattern: /litmos\.com\/scorm/i, label: 'SAP Litmos' },
  ];
  for (const f of files) {
    if (!PROXY_FILENAMES.has(basename(f.path).toLowerCase())) continue;
    try {
      const text = f.data.toString('utf-8');
      for (const { pattern, label } of CLOUD_DOMAINS) {
        if (pattern.test(text)) return label;
      }
    } catch {
      /* ignorar archivo ilegible como texto */
    }
  }
  return null;
}

function basename(filePath: string): string {
  return filePath.split(/[/\\]/).pop() ?? filePath;
}

function dirname(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  parts.pop();
  return parts.join('/');
}

// Misma lógica que parseManifestEntry en scorm.service.ts — duplicada a
// propósito (son 2 módulos pequeños e independientes, no vale la pena una
// dependencia cruzada para esto).
function parseManifestEntry(xml: string): string | null {
  const scoPatterns = [
    /adlcp:scormtype\s*=\s*["']sco["'][^>]*href\s*=\s*["']([^"']+)["']/i,
    /href\s*=\s*["']([^"'?#]+)["'][^>]*adlcp:scormtype\s*=\s*["']sco["']/i,
  ];
  for (const pat of scoPatterns) {
    const m = xml.match(pat);
    if (m?.[1] && !m[1].startsWith('http')) return m[1];
  }
  const hrefHtml = xml.match(/href\s*=\s*["']([^"'?#]*\.html?[^"']*)["']/i);
  if (hrefHtml && !hrefHtml[1].startsWith('http')) return hrefHtml[1];
  return null;
}

function sanitizePath(filePath: string): string {
  return filePath
    .replace(/\\/g, '/')
    .split('/')
    .map((seg) => seg.replace(/[<>:"|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '') || '_')
    .filter(Boolean)
    .join('/');
}

// Aplana la estructura cuando el curso real vive en una subcarpeta (ej.
// imsmanifest.xml en la raíz pero href="index.html" apunta a un archivo
// que en realidad está en "contenido/index.html") — mueve todo el
// contenido de esa subcarpeta a la raíz.
function flattenLaunchMismatch(files: ScormFile[]): ScormFile[] {
  const manifestFile = files.find((f) => basename(f.path).toLowerCase() === 'imsmanifest.xml' && !f.path.includes('/'));
  if (!manifestFile) return files;

  let xml: string;
  try {
    xml = manifestFile.data.toString('utf-8');
  } catch {
    return files;
  }
  const launchHref = parseManifestEntry(xml);
  if (!launchHref) return files;

  const launchAtRoot = files.some((f) => f.path.toLowerCase() === launchHref.toLowerCase());
  if (launchAtRoot) return files;

  const launchName = basename(launchHref).toLowerCase();
  const launchInSub = files.find((f) => f.path.includes('/') && basename(f.path).toLowerCase() === launchName);
  if (!launchInSub) return files;

  const contentPrefix = dirname(launchInSub.path);
  return files.map((f) => {
    const normalized = f.path.replace(/\\/g, '/');
    if (normalized.startsWith(contentPrefix + '/')) {
      return { ...f, path: normalized.slice(contentPrefix.length + 1) };
    }
    return f;
  });
}

async function compressImage(data: Buffer): Promise<Buffer> {
  let quality = 80;
  let compressed = data;
  do {
    compressed = await sharp(data).jpeg({ quality, progressive: true }).toBuffer();
    quality -= 10;
  } while (compressed.length > 500 * 1024 && quality >= 20);
  return compressed;
}

// Corrige lo que se pueda (estructura anidada, nombres ilegales, imágenes
// pesadas) y devuelve tanto los archivos resultantes como un reporte de
// qué se encontró/corrigió, para mostrarlo en el frontend.
export async function optimizePackage(inputFiles: ScormFile[]): Promise<{ files: ScormFile[]; report: OptimizeReport }> {
  const cloudProvider = detectCloudDependency(inputFiles);
  const issues: OptimizeIssue[] = [];

  if (cloudProvider) {
    return {
      files: inputFiles,
      report: {
        cloudProvider,
        isNested: false,
        hasLaunchMismatch: false,
        illegalCharCount: 0,
        imagesCompressed: 0,
        bytesSaved: 0,
        issues: [
          {
            icon: '☁️',
            text: `Paquete dependiente de ${cloudProvider} — el contenido real está alojado en la nube y no se puede corregir localmente.`,
            type: 'cloud',
          },
        ],
      },
    };
  }

  const manifestFile = inputFiles.find((f) => basename(f.path).toLowerCase() === 'imsmanifest.xml');
  const isNested = manifestFile ? manifestFile.path.includes('/') : false;
  if (isNested) {
    issues.push({ icon: '📁', text: `imsmanifest.xml estaba en una subcarpeta (${manifestFile!.path}) — se movió a la raíz.`, type: 'warn' });
  }

  let files = flattenLaunchMismatch(inputFiles);
  const hasLaunchMismatch = files !== inputFiles;
  if (hasLaunchMismatch) {
    issues.push({ icon: '🔗', text: 'El manifest apuntaba a un archivo que estaba en una subcarpeta — se aplanó la estructura.', type: 'warn' });
  }

  const illegalFiles = files.filter((f) => f.path.split('/').some((seg) => ILLEGAL_CHARS.test(seg)));
  if (illegalFiles.length > 0) {
    issues.push({
      icon: '🚫',
      text: `${illegalFiles.length} archivo(s) con caracteres inválidos en el nombre — renombrados.`,
      type: 'warn',
    });
  }

  let imagesCompressed = 0;
  let bytesSaved = 0;
  const outputFiles: ScormFile[] = [];

  for (const f of files) {
    const cleanPath = sanitizePath(f.path);
    const ext = f.path.split('.').pop()?.toLowerCase() ?? '';

    if (COMPRESSIBLE_IMG.has(ext) && f.data.length >= IMG_COMPRESS_THRESHOLD) {
      try {
        const compressed = await compressImage(f.data);
        if (compressed.length < f.data.length) {
          imagesCompressed++;
          bytesSaved += f.data.length - compressed.length;
          outputFiles.push({ path: cleanPath.replace(/\.[^.]+$/, '.jpg'), data: compressed });
          continue;
        }
      } catch {
        /* si sharp falla, se conserva el original sin comprimir */
      }
    }
    outputFiles.push({ path: cleanPath, data: f.data });
  }

  if (imagesCompressed > 0) {
    issues.push({
      icon: '🖼️',
      text: `${imagesCompressed} imagen(es) pesada(s) comprimida(s) — ${(bytesSaved / 1024 / 1024).toFixed(1)} MB ahorrados.`,
      type: 'info',
    });
  }

  if (!issues.length) {
    issues.push({ icon: '✅', text: 'No se encontraron problemas — el paquete ya estaba bien formado.', type: 'ok' });
  }

  return {
    files: outputFiles,
    report: { cloudProvider: null, isNested, hasLaunchMismatch, illegalCharCount: illegalFiles.length, imagesCompressed, bytesSaved, issues },
  };
}
