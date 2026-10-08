import AdmZip from 'adm-zip';

/* ── Category definitions ──────────────────────────────── */
export interface Category {
  key: string;
  label: string;
  emoji: string;
  color: string;
}

export interface FileEntry {
  name: string;
  size: number;
  cat: Category;
  depth: number;
  virtual?: boolean;    // true = data:URI embedded resource (não é arquivo físico no ZIP)
  parentFile?: string;  // caminho do HTML que contém este recurso embutido
}

const CATS: Array<Category & { exts: string[] }> = [
  { key: 'image',  label: 'Imagens',     emoji: '🖼️',  color: '#0FCED3', exts: ['jpg','jpeg','png','gif','svg','webp','bmp','ico','tiff','avif'] },
  { key: 'video',  label: 'Vídeos',      emoji: '🎬',  color: '#F79A19', exts: ['mp4','avi','mov','mkv','webm','ogv','m4v','flv'] },
  { key: 'audio',  label: 'Áudios',      emoji: '🔊',  color: '#F75A50', exts: ['mp3','wav','ogg','aac','m4a','flac','wma','opus'] },
  { key: 'html',   label: 'HTML/XML',    emoji: '🌐',  color: '#19F7F1', exts: ['html','htm','xml','xhtml','xsd'] },
  { key: 'css',    label: 'CSS',         emoji: '🎨',  color: '#72A3C4', exts: ['css','less','sass','scss'] },
  { key: 'js',     label: 'JavaScript',  emoji: '⚙️',  color: '#F7D419', exts: ['js','mjs','ts','jsx','tsx'] },
  { key: 'data',   label: 'Dados',       emoji: '📋',  color: '#19F7A0', exts: ['json','csv','tsv','yml','yaml'] },
  { key: 'doc',    label: 'Documentos',  emoji: '📄',  color: '#4E7EA5', exts: ['pdf','docx','doc','xlsx','xls','pptx','txt','md'] },
  { key: 'font',   label: 'Fontes',      emoji: '🔤',  color: '#A78BFA', exts: ['woff','woff2','ttf','otf','eot'] },
  { key: 'other',  label: 'Outros',      emoji: '📦',  color: '#314668', exts: [] },
];

export function getCategory(filename: string): Category {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  for (const cat of CATS) {
    if (cat.exts.includes(ext)) {
      const { exts: _exts, ...rest } = cat;
      return rest;
    }
  }
  const other = CATS[CATS.length - 1];
  const { exts: _exts, ...rest } = other;
  return rest;
}

/* ── Recursive ZIP analyzer ────────────────────────────── */
export function analyzeZip(
  buffer: Buffer,
  pathPrefix = '',
  depth = 0,
  onProgress?: (msg: string, count: number) => void
): FileEntry[] {
  if (depth > 6) return [];

  const results: FileEntry[] = [];
  let zip: AdmZip;

  try {
    zip = new AdmZip(buffer);
  } catch {
    return results;
  }

  const entries = zip.getEntries();

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const name = entry.entryName;
    const fullPath = pathPrefix + name;
    const ext = name.split('.').pop()?.toLowerCase() ?? '';

    if (ext === 'zip' || ext === 'scorm') {
      // Recursive: open inner ZIP
      onProgress?.(`Abrindo ZIP interno: ${name}`, results.length);
      const innerBuffer = entry.getData();
      const inner = analyzeZip(innerBuffer, fullPath + '/', depth + 1, onProgress);
      results.push(...inner);
    } else {
      results.push({
        name: fullPath,
        size: entry.header.size,  // tamanho descomprimido
        cat: getCategory(name),
        depth,
      });
      if (results.length % 50 === 0) {
        onProgress?.(`Inspecionando… ${results.length} arquivos encontrados`, results.length);
      }

      // Escaneia arquivos HTML por recursos embutidos como data:URI
      if (/\.html?$/i.test(name) && entry.header.size > 0 && entry.header.size <= 100 * 1024 * 1024) {
        try {
          const html = entry.getData().toString('utf-8');
          const EXT_MAP: Record<string, string> = { jpeg: 'jpg', 'svg+xml': 'svg', quicktime: 'mov', mpeg: 'mp3' };
          const dataUriRe = /data:((?:image|video|audio)\/([a-z0-9.+\-]+));base64,([A-Za-z0-9+/]+=*)/g;
          const typeIdxMap: Record<string, number> = {};
          let m: RegExpExecArray | null;
          while ((m = dataUriRe.exec(html)) !== null) {
            const mime = m[1];
            const subtype = m[2];
            const bytes = Math.floor(m[3].length * 0.75);
            const catKey = mime.startsWith('image/') ? 'img' : mime.startsWith('video/') ? 'vid' : 'aud';
            typeIdxMap[catKey] = (typeIdxMap[catKey] ?? 0) + 1;
            const ext = EXT_MAP[subtype] ?? subtype;
            // Nome sintético: mostra o HTML pai e o índice do recurso
            const virtualName = `${fullPath} 📎 ${catKey}_${typeIdxMap[catKey]}.${ext}`;
            results.push({
              name: virtualName,
              size: bytes,
              cat: getCategory(`file.${ext}`),
              depth,
              virtual: true,
              parentFile: fullPath,
            });
          }
        } catch { /* ignora erros de parse */ }
      }
    }
  }

  return results;
}

/* ── Extract ALL files recursively (para download flat) ── */
export interface ExtractedFile {
  path: string;
  data: Buffer;
}

export function extractAllFiles(
  buffer: Buffer,
  pathPrefix = '',
  depth = 0
): ExtractedFile[] {
  if (depth > 6) return [];

  const results: ExtractedFile[] = [];
  let zip: AdmZip;

  try {
    zip = new AdmZip(buffer);
  } catch {
    return results;
  }

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;

    const name = entry.entryName;
    const fullPath = pathPrefix + name;
    const ext = name.split('.').pop()?.toLowerCase() ?? '';

    if (ext === 'zip' || ext === 'scorm') {
      const innerBuffer = entry.getData();
      const inner = extractAllFiles(innerBuffer, fullPath + '/', depth + 1);
      results.push(...inner);
    } else {
      results.push({ path: fullPath, data: entry.getData() });
    }
  }

  return results;
}

/* ── Extract SCORM root (ZIP that contains imsmanifest.xml) ── */
// Traverses nested ZIPs to find the one with imsmanifest.xml, returns its
// files WITHOUT any outer-ZIP-name prefix — paths are clean SCORM internals.
export function extractScormRoot(
  buffer: Buffer,
  depth = 0
): ExtractedFile[] | null {
  if (depth > 6) return null;

  let zip: AdmZip;
  try { zip = new AdmZip(buffer); } catch { return null; }

  const entries = zip.getEntries();

  // Does this ZIP directly contain imsmanifest.xml?
  const hasManifest = entries.some(
    e => !e.isDirectory && e.entryName.toLowerCase().includes('imsmanifest.xml')
  );

  if (hasManifest) {
    const files: ExtractedFile[] = [];
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const ext = entry.entryName.split('.').pop()?.toLowerCase() ?? '';
      // Skip nested ZIPs — we're already at the SCORM root
      if (ext === 'zip' || ext === 'scorm') continue;
      files.push({ path: entry.entryName, data: entry.getData() });
    }
    return files;
  }

  // Recurse into nested ZIPs to find the SCORM root
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const ext = entry.entryName.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'zip' || ext === 'scorm') {
      const inner = extractScormRoot(entry.getData(), depth + 1);
      if (inner !== null) return inner;
    }
  }

  return null;
}

/* ── Extract a single file from ZIP ───────────────────── */
export function extractFile(
  buffer: Buffer,
  targetPath: string,
  depth = 0
): Buffer | null {
  if (depth > 6) return null;

  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return null;
  }

  const entries = zip.getEntries();

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const name = entry.entryName;
    const ext = name.split('.').pop()?.toLowerCase() ?? '';

    if (ext === 'zip' || ext === 'scorm') {
      // Check if targetPath is inside this inner ZIP
      const prefix = name + '/';
      if (targetPath.startsWith(prefix)) {
        const innerBuffer = entry.getData();
        const innerTarget = targetPath.slice(prefix.length);
        const found = extractFile(innerBuffer, innerTarget, depth + 1);
        if (found) return found;
      }
    } else {
      if (name === targetPath) {
        return entry.getData();
      }
    }
  }

  return null;
}
