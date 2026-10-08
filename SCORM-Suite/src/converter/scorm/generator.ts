import AdmZip from 'adm-zip';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { buildManifest } from './manifest';
import { buildVideoWrapper } from './videoWrapper';
import { extractHtmlAssets } from './htmlExtractor';

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.ogv'];

export interface GenerateResult {
  outputPath: string;
  title: string;
}

function newId(): string {
  return uuidv4().replace(/-/g, '').substring(0, 16);
}

function isVideo(filePath: string): boolean {
  return VIDEO_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

/**
 * Encontra o HTML de entrada num zip com múltiplos arquivos.
 * Prioridade: index.html na raiz > qualquer .html na raiz > qualquer .html
 */
function findEntryPoint(entries: string[]): string {
  const htmlFiles = entries.filter(e => e.toLowerCase().endsWith('.html'));
  const rootIndex = htmlFiles.find(e => e.toLowerCase() === 'index.html');
  if (rootIndex) return rootIndex;
  const rootHtml = htmlFiles.find(e => !e.includes('/'));
  if (rootHtml) return rootHtml;
  return htmlFiles[0] ?? 'index.html';
}

// ── Conversor de vídeo ────────────────────────────────────────────────────────
async function convertVideo(
  inputPath: string,
  outputDir: string
): Promise<GenerateResult> {
  const id = newId();
  const videoFileName = path.basename(inputPath);
  const courseTitle = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(outputDir, `${courseTitle}-scorm.zip`);

  const manifest = buildManifest({
    title: courseTitle,
    identifier: id,
    version: '1',
    entryPoint: 'index.html',
    resourceFiles: [videoFileName],
  });

  const wrapper = buildVideoWrapper(videoFileName, courseTitle);

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.append(manifest, { name: 'imsmanifest.xml' });
    archive.append(wrapper, { name: 'index.html' });
    archive.file(inputPath, { name: videoFileName });
    archive.finalize();
  });

  return { outputPath, title: courseTitle };
}

// ── Conversor de HTML único com extração de assets ───────────────────────────
/**
 * Recebe o conteúdo HTML e o título do curso.
 * Extrai todos os assets base64, gera estrutura SCORM organizada.
 */
async function convertSingleHtml(
  htmlContent: string,
  courseTitle: string,
  outputDir: string
): Promise<GenerateResult> {
  const id = newId();
  const outputPath = path.join(outputDir, `${courseTitle}-scorm.zip`);

  // Extrai imagens, fontes e áudios embutidos
  const { html: cleanHtml, files: extractedFiles } = extractHtmlAssets(htmlContent);

  // Injeta SCORM API se não houver
  const hasScormApi = cleanHtml.includes('LMSInitialize') || cleanHtml.includes('API.LMS');
  let finalHtml = cleanHtml;
  if (!hasScormApi) {
    const scormScript = `
  <script>
    /* SCORM 1.2 — injected by scorm-converter */
    (function () {
      var API = null;
      function findAPI(w) {
        var n = 0;
        while (!w.API && w.parent && w.parent !== w && n++ < 10) w = w.parent;
        return w.API || null;
      }
      window.addEventListener('load', function () {
        API = findAPI(window);
        if (!API) return;
        API.LMSInitialize('');
        API.LMSSetValue('cmi.core.lesson_status', 'incomplete');
        API.LMSCommit('');
      });
      window.addEventListener('beforeunload', function () {
        if (!API) return;
        API.LMSSetValue('cmi.core.lesson_status', 'completed');
        API.LMSCommit('');
        API.LMSFinish('');
      });
    })();
  </script>`;
    finalHtml = finalHtml.replace('</head>', scormScript + '\n</head>');
  }

  // Lista de todos os arquivos para o manifesto
  const resourceFiles = extractedFiles.map(f => f.name);

  const manifest = buildManifest({
    title: courseTitle,
    identifier: id,
    version: '1',
    entryPoint: 'index.html',
    resourceFiles,
  });

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    // Manifesto e HTML principal
    archive.append(manifest, { name: 'imsmanifest.xml' });
    archive.append(finalHtml, { name: 'index.html' });

    // Assets extraídos (imagens, fontes, áudios)
    for (const file of extractedFiles) {
      archive.append(file.data, { name: file.name });
    }

    archive.finalize();
  });

  return { outputPath, title: courseTitle };
}

// ── Conversor de zip ──────────────────────────────────────────────────────────
async function convertZip(
  inputPath: string,
  outputDir: string
): Promise<GenerateResult> {
  const id = newId();
  const zipName = path.basename(inputPath, '.zip');
  const outputPath = path.join(outputDir, `${zipName}-scorm.zip`);

  const admZip = new AdmZip(inputPath);

  // Filtra arquivos reais (ignora __MACOSX e entradas de sistema do Mac)
  const realEntries = admZip
    .getEntries()
    .filter(e => !e.isDirectory && !e.entryName.startsWith('__MACOSX') && !path.basename(e.entryName).startsWith('._'));

  const entryNames = realEntries.map(e => e.entryName);
  const htmlFiles = entryNames.filter(e => e.toLowerCase().endsWith('.html'));

  // ── Caso A: zip com um único HTML → extrai assets e organiza ─────────────
  if (htmlFiles.length === 1) {
    const htmlEntry = admZip.getEntry(htmlFiles[0])!;
    const htmlContent = htmlEntry.getData().toString('utf8');
    const courseTitle = zipName;
    return convertSingleHtml(htmlContent, courseTitle, outputDir);
  }

  // ── Caso B: zip já estruturado (múltiplos HTMLs) → preserva estrutura ────
  const entryPoint = findEntryPoint(entryNames);
  const courseTitle = zipName;

  // Verifica se já tem imsmanifest.xml → já é SCORM, só limpa __MACOSX
  const hasManifest = entryNames.some(e => e.toLowerCase() === 'imsmanifest.xml');

  if (hasManifest) {
    // Já é um SCORM válido — reempacota sem os lixos do Mac
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 6 } });
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      for (const entry of realEntries) {
        archive.append(entry.getData(), { name: entry.entryName });
      }
      archive.finalize();
    });
    return { outputPath, title: courseTitle };
  }

  // Zip estruturado sem manifesto → injeta SCORM API e gera manifesto
  const entryEntry = realEntries.find(e => e.entryName === entryPoint);
  let entryContent = entryEntry ? entryEntry.getData().toString('utf8') : '';
  const hasScormApi = entryContent.includes('LMSInitialize') || entryContent.includes('API.LMS');

  if (!hasScormApi && entryContent) {
    const scormScript = `
  <script>
    /* SCORM 1.2 — injected by scorm-converter */
    (function () {
      var API = null;
      function findAPI(w) {
        var n = 0;
        while (!w.API && w.parent && w.parent !== w && n++ < 10) w = w.parent;
        return w.API || null;
      }
      window.addEventListener('load', function () {
        API = findAPI(window);
        if (!API) return;
        API.LMSInitialize('');
        API.LMSSetValue('cmi.core.lesson_status', 'incomplete');
        API.LMSCommit('');
      });
      window.addEventListener('beforeunload', function () {
        if (!API) return;
        API.LMSSetValue('cmi.core.lesson_status', 'completed');
        API.LMSCommit('');
        API.LMSFinish('');
      });
    })();
  </script>`;
    entryContent = entryContent.replace('</head>', scormScript + '\n</head>');
  }

  const resourceFiles = entryNames.filter(n => n !== entryPoint && n.toLowerCase() !== 'imsmanifest.xml');
  const manifest = buildManifest({
    title: courseTitle,
    identifier: id,
    version: '1',
    entryPoint,
    resourceFiles,
  });

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    archive.append(manifest, { name: 'imsmanifest.xml' });

    for (const entry of realEntries) {
      if (entry.entryName === entryPoint && !hasScormApi && entryContent) {
        archive.append(entryContent, { name: entry.entryName });
      } else {
        archive.append(entry.getData(), { name: entry.entryName });
      }
    }

    archive.finalize();
  });

  return { outputPath, title: courseTitle };
}

// ── Função principal ──────────────────────────────────────────────────────────
export async function generateScorm(
  inputPath: string,
  outputDir: string
): Promise<GenerateResult> {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Arquivo não encontrado: ${inputPath}`);
  }

  const ext = path.extname(inputPath).toLowerCase();

  if (isVideo(inputPath)) return convertVideo(inputPath, outputDir);
  if (ext === '.zip') return convertZip(inputPath, outputDir);

  // HTML direto (sem zip)
  if (ext === '.html' || ext === '.htm') {
    const htmlContent = fs.readFileSync(inputPath, 'utf8');
    const courseTitle = path.basename(inputPath, ext);
    return convertSingleHtml(htmlContent, courseTitle, outputDir);
  }

  throw new Error(
    `Tipo de arquivo não suportado: ${ext}. Envie um vídeo (mp4, webm, mov), um .zip ou um .html`
  );
}
