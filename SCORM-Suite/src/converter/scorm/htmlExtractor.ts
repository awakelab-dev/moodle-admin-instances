/**
 * htmlExtractor.ts
 * Extrai assets embutidos (base64) de um HTML e os separa em arquivos organizados.
 * Imagens → imagenes/
 * Fontes  → fonts/
 * Áudios  → imagenes/
 * Vídeos  → imagenes/
 */

export interface ExtractedFile {
  /** Caminho relativo dentro do pacote SCORM, ex: "imagenes/img-001.jpg" */
  name: string;
  data: Buffer;
}

export interface ExtractionResult {
  /** HTML limpo com caminhos relativos nos lugares dos base64 */
  html: string;
  /** Arquivos extraídos prontos para incluir no zip */
  files: ExtractedFile[];
}

// Mapa de mime-type → extensão de arquivo
const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/bmp': 'bmp',
  'font/woff': 'woff',
  'font/woff2': 'woff2',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'application/font-woff': 'woff',
  'application/font-woff2': 'woff2',
  'application/x-font-ttf': 'ttf',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/mp4': 'm4a',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

function getFolder(mime: string): string {
  if (mime.startsWith('font/') || mime.includes('font')) return 'fonts';
  if (mime.startsWith('audio/')) return 'imagenes';
  if (mime.startsWith('video/')) return 'imagenes';
  return 'imagenes';
}

function padNum(n: number): string {
  return String(n).padStart(3, '0');
}

/**
 * Extrai todos os assets base64 embutidos no HTML.
 * Retorna o HTML limpo + lista de arquivos extraídos.
 */
export function extractHtmlAssets(htmlContent: string): ExtractionResult {
  const files: ExtractedFile[] = [];
  const counters: Record<string, number> = {};
  let html = htmlContent;

  function saveAsset(mime: string, b64: string): string {
    const ext = MIME_EXT[mime.toLowerCase()] ?? 'bin';
    const folder = getFolder(mime.toLowerCase());
    const key = `${folder}/${ext}`;
    counters[key] = (counters[key] ?? 0) + 1;
    const name = `${folder}/${folder === 'fonts' ? 'font' : 'img'}-${padNum(counters[key])}.${ext}`;

    // Evita duplicatas: se já existe um arquivo com o mesmo conteúdo, reutiliza
    const buf = Buffer.from(b64, 'base64');
    const existing = files.find(f => f.data.equals(buf));
    if (existing) return existing.name;

    files.push({ name, data: buf });
    return name;
  }

  // ── 1. Extrair base64 de atributos src="data:..." ─────────────────────────
  html = html.replace(
    /(\bsrc=")data:([^;]+);base64,([A-Za-z0-9+/=]+)(")/g,
    (_match, pre, mime, b64, post) => {
      const name = saveAsset(mime, b64);
      return `${pre}${name}${post}`;
    }
  );

  // ── 2. Extrair base64 de atributos href="data:..." (fontes inline via link) ─
  html = html.replace(
    /(\bhref=")data:([^;]+);base64,([A-Za-z0-9+/=]+)(")/g,
    (_match, pre, mime, b64, post) => {
      const name = saveAsset(mime, b64);
      return `${pre}${name}${post}`;
    }
  );

  // ── 3. Extrair base64 dentro de CSS: url("data:...") ou url('data:...') ────
  //    Isso cobre @font-face, background-image, etc.
  html = html.replace(
    /url\((['"]?)data:([^;]+);base64,([A-Za-z0-9+/=]+)\1\)/g,
    (_match, _q, mime, b64) => {
      const name = saveAsset(mime, b64);
      return `url("${name}")`;
    }
  );

  return { html, files };
}
