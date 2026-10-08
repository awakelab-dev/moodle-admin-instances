import express from 'express';
import path from 'path';
import analyzerRoutes from './analyzer/routes';
import converterRoutes from './converter/routes';

const app = express();
const PORT = process.env.PORT ?? 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Página inicial (seletor) — nunca cacheada
app.get('/', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Interfaces de cada ferramenta: /analyzer e /converter
app.use((req, res, next) => {
  if (req.path === '/analyzer/' || req.path === '/converter/') res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.static(PUBLIC_DIR));

// APIs — SCORM Lab (/api/*, /preview/*) e SCORM Converter (/convert)
app.use(analyzerRoutes);
app.use(converterRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   🚀 SCORM Suite rodando!             ║');
  console.log(`║   Acesse: http://localhost:${PORT}      ║`);
  console.log('╚══════════════════════════════════════╝\n');
});
