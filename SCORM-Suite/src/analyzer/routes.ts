import express, { Request, Response } from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import sharp from 'sharp';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { analyzeZip, extractFile, extractAllFiles, extractScormRoot } from './analyzer';

const app = express.Router();

/* ── Upload dir ─────────────────────────────────────────── */
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'analyzer');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ── Preview dir ─────────────────────────────────────────── */
const PREVIEW_DIR = path.join(UPLOAD_DIR, 'previews');
if (!fs.existsSync(PREVIEW_DIR)) fs.mkdirSync(PREVIEW_DIR, { recursive: true });

/* ── Multer: save to disk (handles files de qualquer tamanho) */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, _file, cb) => cb(null, uuidv4() + '.zip'),
});
const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 * 1024 }, // 4 GB max
  fileFilter: (_req, file, cb) => {
    const ok = /\.(zip|scorm)$/i.test(file.originalname);
    cb(null, ok);
  },
});

/* ── Session store (ZIP path por sessionId) ─────────────── */
interface Session {
  zipPath: string;
  originalName: string;
  zipSize: number;
  createdAt: number;
  eventBuffer: object[]; // eventos bufferizados antes do cliente SSE conectar
}
const sessions = new Map<string, Session>();

// Limpa sessões com mais de 2 horas
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > 2 * 60 * 60 * 1000) {
      try { fs.unlinkSync(session.zipPath); } catch {}
      // Remove preview dir se existir
      const previewPath = path.join(PREVIEW_DIR, id);
      if (fs.existsSync(previewPath)) {
        try { fs.rmSync(previewPath, { recursive: true, force: true }); } catch {}
      }
      sessions.delete(id);
    }
  }
}, 10 * 60 * 1000); // roda a cada 10 min

/* ── Middleware ─────────────────────────────────────────── */
app.use(cors());
app.use(express.json());

/* ── Static: serve extracted preview files ──────────────── */
app.use('/preview', express.static(PREVIEW_DIR));

/* ── SSE progress helper ────────────────────────────────── */
const progressClients = new Map<string, Response>();

function sendProgress(sessionId: string, data: object) {
  // Sempre bufferiza — garante que eventos não se percam antes do cliente SSE conectar
  const session = sessions.get(sessionId);
  if (session) session.eventBuffer.push(data);

  const res = progressClients.get(sessionId);
  if (res) res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/* ── GET /api/progress/:sessionId  (SSE) ───────────────── */
app.get('/api/progress/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Repassa todos os eventos já ocorridos (resolve a race condition)
  const session = sessions.get(sessionId);
  if (session) {
    for (const event of session.eventBuffer) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  }

  progressClients.set(sessionId, res);
  req.on('close', () => progressClients.delete(sessionId));
});

/* ── POST /api/analyze ──────────────────────────────────── */
app.post('/api/analyze', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'Nenhum arquivo enviado ou formato inválido.' });
    return;
  }

  const sessionId = uuidv4();
  const zipPath = req.file.path;
  const originalName = req.file.originalname;
  const zipSize = req.file.size;

  sessions.set(sessionId, { zipPath, originalName, zipSize, createdAt: Date.now(), eventBuffer: [] });

  // Processa em background para não bloquear a resposta
  setImmediate(() => {
    try {
      sendProgress(sessionId, { status: 'reading', message: 'Lendo arquivo ZIP…', count: 0 });

      const buffer = fs.readFileSync(zipPath);

      // ── Verificação rápida ANTES da análise completa ───────
      // Evita rodar analyzeZip() (que é pesado) em arquivos que não são SCORM
      sendProgress(sessionId, { status: 'reading', message: 'Verificando pacote SCORM…', count: 0 });
      const quickZip = new AdmZip(buffer);
      const quickEntries = quickZip.getEntries();
      let hasManifest = quickEntries.some(
        e => !e.isDirectory && path.basename(e.entryName).toLowerCase() === 'imsmanifest.xml'
      );
      // Verifica também dentro de ZIPs aninhados (1 nível)
      if (!hasManifest) {
        for (const entry of quickEntries) {
          if (entry.isDirectory) continue;
          const ext = entry.entryName.split('.').pop()?.toLowerCase();
          if (ext === 'zip' || ext === 'scorm') {
            try {
              const inner = new AdmZip(entry.getData());
              if (inner.getEntries().some(e => !e.isDirectory && path.basename(e.entryName).toLowerCase() === 'imsmanifest.xml')) {
                hasManifest = true;
                break;
              }
            } catch {}
          }
        }
      }
      if (!hasManifest) {
        sendProgress(sessionId, {
          status: 'not-scorm',
          message: 'imsmanifest.xml não encontrado — pode não ser um pacote SCORM padrão.',
        });
        // Aguarda o cliente SSE conectar e receber o evento antes de limpar
        setTimeout(() => {
          sessions.delete(sessionId);
          try { fs.unlinkSync(zipPath); } catch {}
        }, 15_000);
        return;
      }
      // ── Análise completa (só chega aqui se for SCORM) ──────

      sendProgress(sessionId, { status: 'analyzing', message: 'Analisando estrutura…', count: 0 });

      const files = analyzeZip(buffer, '', 0, (msg, count) => {
        sendProgress(sessionId, { status: 'analyzing', message: msg, count });
      });

      sendProgress(sessionId, {
        status: 'done',
        sessionId,
        originalName,
        zipSize,
        files,
      });
    } catch (err) {
      sendProgress(sessionId, { status: 'error', message: 'Erro ao processar o arquivo.' });
      sessions.delete(sessionId);
      try { fs.unlinkSync(zipPath); } catch {}
    }
  });

  res.json({ sessionId });
});

/* ── GET /api/download/:sessionId ──────────────────────── */
app.get('/api/download/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const filePath = req.query['path'] as string;

  const session = sessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Sessão expirada ou não encontrada.' });
    return;
  }
  if (!filePath) {
    res.status(400).json({ error: 'Parâmetro "path" obrigatório.' });
    return;
  }

  try {
    const buffer = fs.readFileSync(session.zipPath);
    // targetPath: remove o prefixo do ZIP original (primeiro segmento)
    const targetPath = filePath;
    const fileData = extractFile(buffer, targetPath);

    if (!fileData) {
      res.status(404).json({ error: 'Arquivo não encontrado dentro do ZIP.' });
      return;
    }

    const filename = path.basename(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', fileData.length);
    res.send(fileData);
  } catch {
    res.status(500).json({ error: 'Erro ao extrair o arquivo.' });
  }
});

/* ── GET /api/download-extracted/:sessionId ────────────── */
// Extrai todos os arquivos, comprime imagens pesadas e devolve ZIP otimizado
const COMPRESSIBLE_IMG = new Set(['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'webp', 'avif']);

// Só comprime imagens maiores que este limiar (imagens pequenas ficam maiores após recodificação)
const IMG_COMPRESS_THRESHOLD = 200 * 1024; // 200 KB

app.get('/api/download-extracted/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Sessão expirada.' });
    return;
  }

  try {
    const originalBuffer = fs.readFileSync(session.zipPath);
    const files = extractAllFiles(originalBuffer);

    const newZip = new AdmZip();
    let hadCompression = false;

    for (const f of files) {
      const ext = f.path.split('.').pop()?.toLowerCase() ?? '';

      if (COMPRESSIBLE_IMG.has(ext) && f.data.length >= IMG_COMPRESS_THRESHOLD) {
        // Comprime imagens pesadas (≥ 200 KB) progressivamente até < 500 KB
        try {
          let quality = 80;
          let compressed: Buffer;
          do {
            compressed = await sharp(f.data)
              .jpeg({ quality, progressive: true })
              .toBuffer();
            quality -= 10;
          } while (compressed.length > 500 * 1024 && quality >= 20);

          if (compressed.length < f.data.length) {
            const newPath = f.path.replace(/\.[^.]+$/, '.jpg');
            newZip.addFile(newPath, compressed);
            hadCompression = true;
          } else {
            newZip.addFile(f.path, f.data); // imagem já pequena — mantém original
          }
        } catch {
          newZip.addFile(f.path, f.data); // fallback: original
        }
      } else if ((ext === 'html' || ext === 'htm') && f.data.length > IMG_COMPRESS_THRESHOLD) {
        // Comprime imagens embutidas como data:URI base64 dentro de arquivos HTML
        try {
          const html = f.data.toString('utf-8');
          const COMPRESSIBLE_MIME = /^image\/(jpeg|jpg|png|bmp|tiff|webp|avif|gif)$/;
          const dataUriRe = /data:(image\/[a-z0-9.+\-]+);base64,([A-Za-z0-9+/]+=*)/g;
          let m: RegExpExecArray | null;
          const replacements: Array<{ start: number; end: number; replacement: string }> = [];

          while ((m = dataUriRe.exec(html)) !== null) {
            const mime = m[1];
            if (!COMPRESSIBLE_MIME.test(mime)) continue;
            const b64 = m[2];
            const imgBytes = Math.floor(b64.length * 0.75);
            if (imgBytes < IMG_COMPRESS_THRESHOLD) continue; // ignora imagens pequenas

            try {
              const imgBuf = Buffer.from(b64, 'base64');
              let quality = 80;
              let compressed: Buffer;
              do {
                compressed = await sharp(imgBuf)
                  .jpeg({ quality, progressive: true })
                  .toBuffer();
                quality -= 10;
              } while (compressed.length > 500 * 1024 && quality >= 20);

              if (compressed.length < imgBytes) {
                const newB64 = compressed.toString('base64');
                replacements.push({
                  start: m.index,
                  end: m.index + m[0].length,
                  replacement: `data:image/jpeg;base64,${newB64}`,
                });
                hadCompression = true;
              }
            } catch { /* pula esta imagem se sharp falhar */ }
          }

          if (replacements.length > 0) {
            // Aplica substituições em ordem reversa para manter os índices corretos
            let result = html;
            for (let i = replacements.length - 1; i >= 0; i--) {
              const r = replacements[i];
              result = result.slice(0, r.start) + r.replacement + result.slice(r.end);
            }
            newZip.addFile(f.path, Buffer.from(result, 'utf-8'));
          } else {
            newZip.addFile(f.path, f.data);
          }
        } catch {
          newZip.addFile(f.path, f.data); // fallback: original
        }
      } else {
        newZip.addFile(f.path, f.data);
      }
    }

    const newZipBuffer = newZip.toBuffer();

    // Se houve alguma compressão, devolve o ZIP otimizado; caso contrário, devolve o original
    const finalBuffer = hadCompression ? newZipBuffer : originalBuffer;
    const suffix = hadCompression ? '_comprimido' : '_extraido';
    const filename = session.originalName.replace(/\.(zip|scorm)$/i, '') + suffix + '.zip';
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', 'application/zip');
    res.send(finalBuffer);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao comprimir os arquivos.' });
  }
});

/* ── GET /api/download-all/:sessionId ──────────────────── */
app.get('/api/download-all/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Sessão expirada.' });
    return;
  }

  // Stream the original ZIP back as-is (already decompressed on analysis)
  const filename = session.originalName.replace(/\.(zip|scorm)$/i, '') + '_extraido.zip';
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.setHeader('Content-Type', 'application/zip');
  fs.createReadStream(session.zipPath).pipe(res);
});

/* ── Helper: sanitiza segmentos de caminho (remove chars ilegais Windows) ── */
function sanitizePreviewPath(filePath: string): string {
  return filePath
    .split(/[/\\]/)
    .map(seg =>
      seg
        .replace(/[<>:"|?*\x00-\x1f]/g, '_') // chars ilegais Windows
        .replace(/[. ]+$/, '')                // ponto/espaço no final
      || '_'
    )
    .filter(Boolean)
    .join('/');
}

/* ── Helpers: busca recursiva de arquivo ─────────────────── */
function findFileRecursive(dir: string, filename: string): string | null {
  if (!fs.existsSync(dir)) return null;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findFileRecursive(full, filename);
        if (found) return found;
      } else if (entry.name.toLowerCase() === filename.toLowerCase()) {
        return full;
      }
    }
  } catch {}
  return null;
}

/* ── Helper: parseia imsmanifest.xml e retorna o href da SCO ─ */
function parseManifestEntry(xml: string): string | null {
  // Estratégia 1: resource com adlcp:scormtype="sco" e href
  const scoPatterns = [
    /adlcp:scormtype\s*=\s*["']sco["'][^>]*href\s*=\s*["']([^"']+)["']/i,
    /href\s*=\s*["']([^"'?#]+)["'][^>]*adlcp:scormtype\s*=\s*["']sco["']/i,
    /adlcp:scormType\s*=\s*["']sco["'][^>]*href\s*=\s*["']([^"']+)["']/i,
    /href\s*=\s*["']([^"'?#]+)["'][^>]*adlcp:scormType\s*=\s*["']sco["']/i,
  ];
  for (const pat of scoPatterns) {
    const m = xml.match(pat);
    if (m && m[1] && !m[1].startsWith('http')) return m[1];
  }

  // Estratégia 2: organização padrão → identifierref do primeiro item → href do recurso
  const defOrgMatch = xml.match(/organizations\s[^>]*default\s*=\s*["']([^"']+)["']/i);
  if (defOrgMatch) {
    const orgId = defOrgMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const orgBlock = xml.match(new RegExp(`identifier\\s*=\\s*["']${orgId}["'][\\s\\S]*?</organization>`, 'i'));
    if (orgBlock) {
      const itemRef = orgBlock[0].match(/identifierref\s*=\s*["']([^"']+)["']/i);
      if (itemRef) {
        const resId = itemRef[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const resBlock = xml.match(new RegExp(`identifier\\s*=\\s*["']${resId}["'][^>]*href\\s*=\\s*["']([^"']+)["']`, 'i'));
        if (resBlock && resBlock[1] && !resBlock[1].startsWith('http')) return resBlock[1];
      }
    }
  }

  // Estratégia 3: qualquer resource com href que aponte para HTML
  const hrefHtml = xml.match(/href\s*=\s*["']([^"'?#]*\.html?[^"']*)["']/i);
  if (hrefHtml && !hrefHtml[1].startsWith('http')) return hrefHtml[1];

  // Estratégia 4: qualquer resource com href relativo
  const anyHref = xml.match(/href\s*=\s*["']([^"']+)["']/i);
  if (anyHref && !anyHref[1].startsWith('http')) return anyHref[1];

  return null;
}

/* ── Helper: detecta pacotes SCORM proxy-cloud (ex: scormNEXT) ── */
// Só retorna positivo quando há assinatura DUPLA: arquivos proxy característicos
// E referência a domínio de nuvem específico nesses arquivos — evita falsos positivos.
function detectCloudDependency(files: Array<{ path: string; data: Buffer }>): string | null {
  // Nomes de arquivo que só existem em pacotes proxy-cloud
  const PROXY_SIGNATURES = ['proxy.html', 'redirect.html', 'scorm_wrapper.html'];
  const fileNames = files.map(f => path.basename(f.path).toLowerCase());
  const proxyCount = PROXY_SIGNATURES.filter(p => fileNames.includes(p)).length;

  // Exige ao menos 2 arquivos proxy para reduzir falsos positivos
  if (proxyCount < 2) return null;

  // Só inspeciona arquivos sabidamente do proxy (config.js + arquivos proxy)
  const PROXY_FILENAMES = new Set([...PROXY_SIGNATURES, 'config.js']);
  const CLOUD_DOMAINS: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /scormnext|scormproxy\.com|backend\.scormnext\.es/i, label: 'scormNEXT' },
    { pattern: /app\.scorm\.cloud|api\.rustici\.com/i,              label: 'SCORM Cloud' },
    { pattern: /agilix\.com|buzz\.agilix\.com/i,                    label: 'Agilix Buzz' },
    { pattern: /litmos\.com\/scorm/i,                               label: 'SAP Litmos' },
  ];

  for (const f of files) {
    if (!PROXY_FILENAMES.has(path.basename(f.path).toLowerCase())) continue;
    try {
      const text = f.data.toString('utf-8');
      for (const { pattern, label } of CLOUD_DOMAINS) {
        if (pattern.test(text)) return label;
      }
    } catch {}
  }
  return null;
}

/* ── Helper: detecta e classifica problemas no pacote ────── */
interface DiagnosticResult {
  cloudProvider: string | null;
  isNested: boolean;
  illegalCharCount: number;
  hasLaunchMismatch: boolean;
  isFixable: boolean;
  issues: Array<{ icon: string; text: string; type: 'cloud' | 'warn' | 'info' | 'ok' }>;
}

function detectFixableIssues(files: Array<{ path: string; data: Buffer }>): DiagnosticResult {
  // 1. Cloud dependency — não fixável
  const cloudProvider = detectCloudDependency(files);
  if (cloudProvider) {
    return {
      cloudProvider,
      isNested: false,
      illegalCharCount: 0,
      hasLaunchMismatch: false,
      isFixable: false,
      issues: [{
        icon: '☁️',
        text: `Pacote dependente de ${cloudProvider} — o conteúdo real está hospedado na nuvem e não pode ser corrigido localmente.`,
        type: 'cloud',
      }],
    };
  }

  const issues: DiagnosticResult['issues'] = [];

  // 2. Estrutura aninhada (imsmanifest.xml não está na raiz)
  const manifestFile = files.find(f => path.basename(f.path).toLowerCase() === 'imsmanifest.xml');
  const isNested = manifestFile
    ? manifestFile.path.includes('/') || manifestFile.path.includes('\\')
    : false;

  if (isNested) {
    issues.push({
      icon: '📁',
      text: `imsmanifest.xml está em subpasta (${manifestFile!.path}) — LMSs como Moodle exigem que esteja na raiz do ZIP.`,
      type: 'warn',
    });
  } else if (!manifestFile) {
    issues.push({
      icon: '❓',
      text: 'imsmanifest.xml não encontrado — pode não ser um pacote SCORM padrão.',
      type: 'warn',
    });
  }

  // 3. Launch mismatch: manifest na raiz aponta para arquivo inexistente na raiz
  // (conteúdo real está em subpasta — SCORM Cloud importa mas falha ao lançar)
  let hasLaunchMismatch = false;
  if (!isNested && manifestFile) {
    try {
      const manifestXml = manifestFile.data.toString('utf-8');
      const launchHref = parseManifestEntry(manifestXml);
      if (launchHref) {
        const launchName = launchHref.split(/[/\\]/).pop()!.toLowerCase();
        const launchAtRoot = files.some(f =>
          !f.path.includes('/') && !f.path.includes('\\') &&
          f.path.toLowerCase() === launchHref.toLowerCase()
        );
        if (!launchAtRoot) {
          const launchInSub = files.find(f =>
            (f.path.includes('/') || f.path.includes('\\')) &&
            path.basename(f.path).toLowerCase() === launchName
          );
          if (launchInSub) {
            hasLaunchMismatch = true;
            issues.push({
              icon: '🔗',
              text: `O manifest aponta para "${launchHref}" na raiz, mas o arquivo está em "${launchInSub.path}" — o curso não vai lançar no LMS.`,
              type: 'warn',
            });
          }
        }
      }
    } catch {}
  }

  // 4. Caracteres ilegais em nomes de arquivo
  const ILLEGAL_CHARS = /[<>:"|?*\x00-\x1f]/;
  const illegalFiles = files.filter(f =>
    f.path.split(/[/\\]/).some(seg => ILLEGAL_CHARS.test(seg))
  );
  const illegalCharCount = illegalFiles.length;
  if (illegalCharCount > 0) {
    issues.push({
      icon: '🚫',
      text: `${illegalCharCount} arquivo${illegalCharCount > 1 ? 's' : ''} com caracteres inválidos no nome (incompatível com Windows e Moodle).`,
      type: 'warn',
    });
  }

  // 5. HTML com recursos embutidos como data:URI (slides exportados de Canva, Genially, etc.)
  // Analisa apenas HTMLs ≤ 100 MB para evitar travamento
  const MAX_HTML_SCAN = 100 * 1024 * 1024;
  const htmlFiles = files.filter(f => /\.html?$/i.test(f.path) && f.data.length <= MAX_HTML_SCAN);
  for (const htmlFile of htmlFiles) {
    try {
      const html = htmlFile.data.toString('utf-8');
      const MEDIA_CATEGORIES: Record<string, string> = {
        'image/': 'imagem', 'video/': 'vídeo', 'audio/': 'áudio',
      };
      const dataUriRe = /data:((?:image|video|audio)\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+=*)/g;
      const byCategory: Record<string, { count: number; bytes: number }> = {};
      let m: RegExpExecArray | null;
      while ((m = dataUriRe.exec(html)) !== null) {
        const mime = m[1];
        const cat = Object.keys(MEDIA_CATEGORIES).find(k => mime.startsWith(k)) ?? 'outro/';
        if (!byCategory[cat]) byCategory[cat] = { count: 0, bytes: 0 };
        byCategory[cat].count++;
        byCategory[cat].bytes += Math.floor(m[2].length * 0.75);
      }
      if (Object.keys(byCategory).length > 0) {
        const totalBytes = Object.values(byCategory).reduce((s, v) => s + v.bytes, 0);
        const totalMB   = (totalBytes / (1024 * 1024)).toFixed(1);
        const summary = Object.entries(byCategory)
          .map(([cat, { count }]) => `${count} ${MEDIA_CATEGORIES[cat] ?? cat}${count > 1 ? 's' : ''}`)
          .join(', ');
        issues.push({
          icon: '📎',
          text: `${path.basename(htmlFile.path)}: contém ${summary} embutidos como data:URI (~${totalMB} MB) — alguns LMSs rejeitam HTMLs muito grandes ou carregam com lentidão.`,
          type: 'info',
        });
      }
    } catch {}
  }

  // Imagens/mídias como arquivos separados não são reportadas aqui — já existe o botão
  // "Comprimir e Baixar" que cuida disso. O diagnóstico foca em problemas estruturais.

  const isFixable = isNested || illegalCharCount > 0 || hasLaunchMismatch;

  return {
    cloudProvider: null,
    isNested,
    illegalCharCount,
    hasLaunchMismatch,
    isFixable,
    issues,
  };
}

/* ── GET /api/diagnose/:sessionId ────────────────────────── */
app.get('/api/diagnose/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  if (!session) { res.status(404).json({ error: 'Sessão expirada.' }); return; }

  try {
    const buffer = fs.readFileSync(session.zipPath);
    const files = extractAllFiles(buffer);
    const result = detectFixableIssues(files);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: `Erro ao diagnosticar: ${err?.message || 'desconhecido'}` });
  }
});

/* ── GET /api/fix-zip/:sessionId ─────────────────────────── */
// Corrige estrutura aninhada, chars ilegais e comprime imagens pesadas
app.get('/api/fix-zip/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  if (!session) { res.status(404).json({ error: 'Sessão expirada.' }); return; }

  try {
    const originalBuffer = fs.readFileSync(session.zipPath);

    // Extrai usando extractScormRoot para corrigir estrutura aninhada automaticamente
    let files = extractScormRoot(originalBuffer);
    if (!files) files = extractAllFiles(originalBuffer);

    // Corrige launch mismatch: manifest na raiz aponta para arquivo em subpasta
    // (ex: href="index.html" mas o arquivo real está em "conteudo/index.html")
    const rootManifestFile = files.find(f =>
      path.basename(f.path).toLowerCase() === 'imsmanifest.xml' &&
      !f.path.includes('/') && !f.path.includes('\\')
    );
    if (rootManifestFile) {
      try {
        const xml = rootManifestFile.data.toString('utf-8');
        const launchHref = parseManifestEntry(xml);
        if (launchHref) {
          const launchAtRoot = files.some(f => f.path.toLowerCase() === launchHref.toLowerCase());
          if (!launchAtRoot) {
            const launchName = path.basename(launchHref).toLowerCase();
            const launchInSub = files.find(f =>
              (f.path.includes('/') || f.path.includes('\\')) &&
              path.basename(f.path).toLowerCase() === launchName
            );
            if (launchInSub) {
              // Move todos os arquivos da subpasta do conteúdo para a raiz
              const contentPrefix = path.dirname(launchInSub.path).replace(/\\/g, '/');
              files = files.map(f => {
                const normalized = f.path.replace(/\\/g, '/');
                if (normalized.startsWith(contentPrefix + '/')) {
                  return { ...f, path: normalized.slice(contentPrefix.length + 1) };
                }
                return f;
              });
            }
          }
        }
      } catch {}
    }

    const newZip = new AdmZip();

    for (const f of files) {
      // Sanitiza o caminho (remove caracteres ilegais Windows)
      const cleanPath = sanitizePreviewPath(f.path);
      const ext = f.path.split('.').pop()?.toLowerCase() ?? '';

      if (COMPRESSIBLE_IMG.has(ext) && f.data.length >= IMG_COMPRESS_THRESHOLD) {
        // Comprime imagens pesadas progressivamente
        try {
          let quality = 80;
          let compressed: Buffer;
          do {
            compressed = await sharp(f.data)
              .jpeg({ quality, progressive: true })
              .toBuffer();
            quality -= 10;
          } while (compressed.length > 500 * 1024 && quality >= 20);

          if (compressed.length < f.data.length) {
            const newPath = cleanPath.replace(/\.[^.]+$/, '.jpg');
            newZip.addFile(newPath, compressed);
          } else {
            newZip.addFile(cleanPath, f.data);
          }
        } catch {
          newZip.addFile(cleanPath, f.data);
        }
      } else {
        newZip.addFile(cleanPath, f.data);
      }
    }

    const fixedBuffer = newZip.toBuffer();
    const baseName = session.originalName.replace(/\.(zip|scorm)$/i, '');
    const filename = `${baseName}_corrigido.zip`;

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', 'application/zip');
    res.send(fixedBuffer);
  } catch (err: any) {
    console.error('[fix-zip] EXCEPTION:', err?.message || err);
    res.status(500).json({ error: `Erro ao corrigir: ${err?.message || 'desconhecido'}` });
  }
});

/* ── GET /api/prepare-preview/:sessionId ────────────────── */
// Extrai arquivos para disco e devolve o ponto de entrada do curso
app.get('/api/prepare-preview/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  if (!session) { res.status(404).json({ error: 'Sessão expirada.' }); return; }

  const previewPath = path.join(PREVIEW_DIR, sessionId);

  try {
    // Extrair arquivos (apenas uma vez por sessão)
    let extractedFiles: Array<{ path: string; data: Buffer }>;

    if (!fs.existsSync(previewPath)) {
      const buffer = fs.readFileSync(session.zipPath);

      // Estratégia 1: extrai direto do ZIP que contém imsmanifest.xml
      let files = extractScormRoot(buffer);
      // Estratégia 2 (fallback): extrai tudo com sanitização de caminhos
      if (!files) files = extractAllFiles(buffer);

      extractedFiles = files;

      // ── Detecta dependência de nuvem ANTES de gravar no disco ──────────────
      const cloudProvider = detectCloudDependency(files);
      if (cloudProvider) {
        res.status(422).json({
          errorType: 'cloud_dependent',
          provider: cloudProvider,
          error: `Este pacote usa ${cloudProvider} — o conteúdo real está hospedado na nuvem e só pode ser visualizado por um LMS autorizado. O SCORM Lab não consegue exibir pacotes deste tipo localmente.`,
        });
        return;
      }

      for (const f of files) {
        const safePath = sanitizePreviewPath(f.path);
        const dest = path.join(previewPath, safePath);
        const dir  = path.dirname(dest);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(dest, f.data);
      }
    } else {
      // Já extraído — reconstrói lista para checar dependência
      extractedFiles = [];
    }

    // Procura imsmanifest.xml
    let entryPoint: string | null = null;
    const manifestPath = findFileRecursive(previewPath, 'imsmanifest.xml');

    console.log('[prepare-preview] manifestPath:', manifestPath);

    if (manifestPath) {
      const xml = fs.readFileSync(manifestPath, 'utf-8');
      const relEntry = parseManifestEntry(xml);
      console.log('[prepare-preview] parseManifestEntry result:', relEntry);
      if (relEntry) {
        const manifestDir = path.relative(previewPath, path.dirname(manifestPath)).replace(/\\/g, '/');
        entryPoint = manifestDir && manifestDir !== '.' ? `${manifestDir}/${relEntry}` : relEntry;
      } else {
        // Debug: mostra os primeiros hrefs encontrados no manifest para diagnóstico
        const hrefs = [...xml.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]).slice(0, 5);
        console.log('[prepare-preview] hrefs no manifest:', hrefs);
      }
    } else {
      console.log('[prepare-preview] imsmanifest.xml não encontrado. Arquivos em disco:');
      try {
        const listDir = (dir: string, depth = 0): void => {
          if (depth > 3) return;
          fs.readdirSync(dir).forEach(f => {
            console.log('  ' + '  '.repeat(depth) + f);
            const full = path.join(dir, f);
            if (fs.statSync(full).isDirectory()) listDir(full, depth + 1);
          });
        };
        listDir(previewPath);
      } catch {}
    }

    // Fallback 1: index.html
    if (!entryPoint) {
      const idxPath = findFileRecursive(previewPath, 'index.html');
      if (idxPath) {
        entryPoint = path.relative(previewPath, idxPath).replace(/\\/g, '/');
        console.log('[prepare-preview] usando fallback index.html:', entryPoint);
      }
    }

    // Fallback 2: qualquer .html
    if (!entryPoint) {
      const findAnyHtml = (dir: string): string | null => {
        if (!fs.existsSync(dir)) return null;
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
              const found = findAnyHtml(full);
              if (found) return found;
            } else if (/\.html?$/i.test(e.name)) {
              return full;
            }
          }
        } catch {}
        return null;
      };
      const anyHtml = findAnyHtml(previewPath);
      if (anyHtml) {
        entryPoint = path.relative(previewPath, anyHtml).replace(/\\/g, '/');
        console.log('[prepare-preview] usando fallback HTML genérico:', entryPoint);
      }
    }

    if (!entryPoint) {
      const diagnosticMsg = manifestPath
        ? 'imsmanifest.xml encontrado mas sem href de entrada válido. Verifique o terminal do servidor para detalhes.'
        : 'imsmanifest.xml não encontrado no pacote e nenhum arquivo .html localizado.';
      console.error('[prepare-preview] sem entry point:', diagnosticMsg);
      res.status(404).json({ error: diagnosticMsg });
      return;
    }

    res.json({ sessionId, entryPoint, courseName: session.originalName.replace(/\.(zip|scorm)$/i, '') });
  } catch (err: any) {
    console.error('[prepare-preview] EXCEPTION:', err?.message || err);
    res.status(500).json({ error: `Erro interno: ${err?.message || 'desconhecido'}` });
  }
});

/* ── GET /api/preview-player/:sessionId ─────────────────── */
// Retorna a página do player SCORM (com API shim + iframe)
app.get('/api/preview-player/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const entryPoint = req.query['entry'] as string;
  const courseName = req.query['name'] as string || 'Curso SCORM';
  const session = sessions.get(sessionId);

  if (!session || !entryPoint) {
    res.status(404).send('<h1>Sessão expirada ou parâmetros inválidos.</h1>');
    return;
  }

  const courseUrl = `/preview/${sessionId}/${entryPoint}`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${courseName} — SCORM Player</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; overflow: hidden; background: #011932; }
  body { display: flex; flex-direction: column; font-family: 'Poppins', sans-serif; }

  .player-bar {
    flex-shrink: 0; height: 44px;
    background: #01264C; border-bottom: 1px solid rgba(25,247,241,.15);
    display: flex; align-items: center; gap: 14px; padding: 0 16px;
  }
  .player-logo { display: flex; align-items: center; gap: 7px; text-decoration: none; }
  .player-logo svg { flex-shrink: 0; }
  .player-logo-text { font-size: 13px; font-weight: 800; color: #D9FBFF; letter-spacing: -.02em; }
  .divider { width: 1px; height: 20px; background: rgba(25,247,241,.15); flex-shrink: 0; }
  .player-title { font-size: 12px; color: #72A3C4; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .player-badge {
    background: rgba(15,206,211,.12); border: 1px solid rgba(15,206,211,.3);
    color: #0FCED3; border-radius: 20px; padding: 2px 12px;
    font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; flex-shrink: 0;
  }
  .scorm-frame { flex: 1; border: none; width: 100%; background: white; }
  .status-bar {
    flex-shrink: 0; height: 26px;
    background: #011932; border-top: 1px solid rgba(25,247,241,.08);
    display: flex; align-items: center; padding: 0 16px; gap: 16px;
  }
  .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #19F7A0; animation: pulse 2s infinite; flex-shrink: 0; }
  @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.35} }
  .status-text { font-size: 10px; color: #4E7EA5; font-weight: 500; flex: 1; }
  .status-log { font-size: 10px; color: #27334F; font-family: 'Courier New', monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 50%; }
</style>
</head>
<body>
  <div class="player-bar">
    <a class="player-logo" href="/" target="_blank">
      <svg width="22" height="22" viewBox="0 0 26 26" fill="none">
        <path d="M13 2L25 23H1L13 2Z" fill="none" stroke="#0FCED3" stroke-width="2" stroke-linejoin="round"/>
        <path d="M7 17L13 7L19 17" fill="none" stroke="#19F7F1" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
      <span class="player-logo-text">awakelab</span>
    </a>
    <div class="divider"></div>
    <span class="player-title">${courseName.replace(/</g,'&lt;')}</span>
    <span class="player-badge">SCORM Player</span>
  </div>

  <iframe
    id="scormFrame"
    class="scorm-frame"
    src="${courseUrl}"
    allow="fullscreen"
    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-downloads"
  ></iframe>

  <div class="status-bar">
    <div class="status-dot"></div>
    <span class="status-text">LMS emulado · SCORM 1.2 + 2004</span>
    <span class="status-log" id="statusLog">—</span>
  </div>

<script>
/* ── SCORM 1.2 API ────────────────────────────────────────── */
// Valores padrão obrigatórios — evita que cursos rejeitem o usuário como "anônimo"
const scormData = {
  'cmi.core.student_id'      : 'preview_user',
  'cmi.core.student_name'    : 'Usuario Preview',
  'cmi.core.lesson_status'   : 'not attempted',
  'cmi.core.credit'          : 'credit',
  'cmi.core.entry'           : 'ab-initio',
  'cmi.core.lesson_mode'     : 'normal',
  'cmi.core.score.raw'       : '',
  'cmi.core.score.min'       : '0',
  'cmi.core.score.max'       : '100',
  'cmi.core.total_time'      : '0000:00:00.00',
  'cmi.core.session_time'    : '0000:00:00.00',
  'cmi.suspend_data'         : '',
  'cmi.launch_data'          : '',
  'cmi.student_preference.language': '',
  'cmi.student_preference.audio'   : '0',
  'cmi.student_preference.speed'   : '0',
  'cmi.student_preference.text'    : '0',
};

window.API = {
  LMSInitialize: function(s) {
    log('LMSInitialize()'); return 'true';
  },
  LMSFinish: function(s) {
    log('LMSFinish()'); return 'true';
  },
  LMSGetValue: function(k) {
    const v = (k in scormData) ? scormData[k] : '';
    log('LMSGetValue(' + k + ') → ' + v); return v;
  },
  LMSSetValue: function(k, v) {
    scormData[k] = v;
    log('LMSSetValue(' + k + ', ' + v + ')'); return 'true';
  },
  LMSCommit: function(s) {
    log('LMSCommit()'); return 'true';
  },
  LMSGetLastError: function() { return '0'; },
  LMSGetErrorString: function(c) { return ''; },
  LMSGetDiagnostic: function(c) { return ''; }
};

/* ── SCORM 2004 API ───────────────────────────────────────── */
const scormData2004 = {
  'cmi.learner_id'          : 'preview_user',
  'cmi.learner_name'        : 'Usuario Preview',
  'cmi.completion_status'   : 'not attempted',
  'cmi.success_status'      : 'unknown',
  'cmi.credit'              : 'credit',
  'cmi.entry'               : 'ab-initio',
  'cmi.mode'                : 'normal',
  'cmi.score.raw'           : '',
  'cmi.score.min'           : '0',
  'cmi.score.max'           : '100',
  'cmi.total_time'          : 'PT0S',
  'cmi.suspend_data'        : '',
  'cmi.launch_data'         : '',
};

window.API_1484_11 = {
  Initialize: function(s) {
    log('[2004] Initialize()'); return 'true';
  },
  Terminate: function(s) {
    log('[2004] Terminate()'); return 'true';
  },
  GetValue: function(k) {
    const v = (k in scormData2004) ? scormData2004[k] : '';
    log('[2004] GetValue(' + k + ') → ' + v); return v;
  },
  SetValue: function(k, v) {
    scormData2004[k] = v;
    log('[2004] SetValue(' + k + ', ' + v + ')'); return 'true';
  },
  Commit: function(s) {
    log('[2004] Commit()'); return 'true';
  },
  GetLastError: function() { return '0'; },
  GetErrorString: function(c) { return ''; },
  GetDiagnostic: function(c) { return ''; }
};

function log(msg) {
  const el = document.getElementById('statusLog');
  if (el) el.textContent = msg;
}
</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default app;
