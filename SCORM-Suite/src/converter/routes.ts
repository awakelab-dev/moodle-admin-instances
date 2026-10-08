import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { generateScorm } from './scorm/generator';

const app = express.Router();

// ── Pastas de trabalho ──────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'converter');
const OUTPUTS_DIR = path.join(__dirname, '..', '..', 'outputs');

[UPLOADS_DIR, OUTPUTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── Multer (upload) ─────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const ALLOWED_MIMETYPES = [
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
  'video/x-matroska', 'video/ogg',
  'application/zip', 'application/x-zip-compressed',
];

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.ogv', '.zip'];
    if (allowedExts.includes(ext) || ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de arquivo não suportado: ${ext}`));
    }
  },
});

// ── Limpeza de arquivos antigos (>1h) ──────────────────────────────
function cleanOldFiles(dir: string, maxAgeMs = 60 * 60 * 1000) {
  if (!fs.existsSync(dir)) return;
  const now = Date.now();
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    try {
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > maxAgeMs) fs.unlinkSync(filePath);
    } catch {
      // ignora erros de limpeza
    }
  });
}

// ── Rota: POST /convert ─────────────────────────────────────────────
app.post('/convert', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    return;
  }

  const inputPath = req.file.path;

  try {
    cleanOldFiles(UPLOADS_DIR);
    cleanOldFiles(OUTPUTS_DIR);

    const { outputPath, title } = await generateScorm(inputPath, OUTPUTS_DIR);

    // Envia o arquivo SCORM para download
    res.download(outputPath, `${title}-scorm.zip`, err => {
      // Limpa arquivos temporários após envio
      try { fs.unlinkSync(inputPath); } catch {}
      try { fs.unlinkSync(outputPath); } catch {}
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Erro ao enviar o arquivo.' });
      }
    });
  } catch (err: unknown) {
    try { fs.unlinkSync(inputPath); } catch {}
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    res.status(500).json({ error: message });
  }
});

export default app;
