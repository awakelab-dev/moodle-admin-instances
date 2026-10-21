import type { EmailDesignRenderer } from './types';
import { initialsFor, escapeHtml } from './helpers';

// Diseño B — "Oscuro moderno": el mismo lenguaje del propio dashboard
// (navy + cian brillante), logo cuadrado en vez de círculo.
export const darkModernDesign: EmailDesignRenderer = ({ platformName, subject, bodyHtml }) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(subject)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  body { margin: 0; padding: 32px 16px; background: #080D18; font-family: 'Poppins', Arial, sans-serif; }
  .email { max-width: 600px; margin: 0 auto; background: #0D1526; border-radius: 14px; overflow: hidden; }
  .head { padding: 28px 28px 18px; display: flex; align-items: center; gap: 12px; }
  .logo { width: 38px; height: 38px; border-radius: 10px; background: #15F0E0; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #04222A; font-size: 0.9rem; }
  .brand { font-size: 1rem; font-weight: 700; color: #F2F6FF; }
  .bar { height: 3px; background: #15F0E0; margin: 0 28px 24px; border-radius: 2px; opacity: 0.5; }
  .content { padding: 0 28px 8px; color: #B7C0DE; font-size: 0.9rem; line-height: 1.7; }
  .content p { margin: 0 0 18px; }
  .content strong, .content b { color: #fff; }
  .content a { color: #7FE3DA; }
  .content ul, .content ol { margin: 0 0 18px; padding-left: 20px; }
  .content li { margin-bottom: 8px; }
  .foot { padding: 20px 28px; border-top: 1px solid #1C2944; }
  .foot p { font-size: 0.72rem; color: #5A6684; margin: 4px 0; }
</style>
</head>
<body>
  <div class="email">
    <div class="head">
      <div class="logo">${escapeHtml(initialsFor(platformName))}</div>
      <div class="brand">${escapeHtml(platformName)}</div>
    </div>
    <div class="bar"></div>
    <div class="content">${bodyHtml}</div>
    <div class="foot">
      <p>${escapeHtml(platformName)}</p>
    </div>
  </div>
</body>
</html>
`;
