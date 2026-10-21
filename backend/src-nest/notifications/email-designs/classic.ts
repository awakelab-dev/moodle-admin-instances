import type { EmailDesignRenderer } from './types';
import { initialsFor, escapeHtml } from './helpers';

// Diseño A — "Clásico corporativo": navy + cian de principio a fin,
// aprobado por el instructor tras varias rondas (ver boceto compartido).
export const classicDesign: EmailDesignRenderer = ({ platformName, subject, bodyHtml }) => `<!DOCTYPE html>
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
  body { margin: 0; padding: 32px 16px; background: #05070C; font-family: 'Poppins', Arial, sans-serif; }
  .email { max-width: 600px; margin: 0 auto; background: #0F1A2E; border-radius: 14px; overflow: hidden; }
  .head { background: #0F1A2E; padding: 32px 28px 16px; text-align: center; }
  .logo { display: inline-flex; align-items: center; justify-content: center; width: 50px; height: 50px; border-radius: 12px; background: #0FCED3; color: #04222A; font-weight: 800; font-size: 1rem; margin-bottom: 12px; }
  .tag { font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; color: #7E8AA8; font-weight: 700; }
  .bar { height: 4px; background: linear-gradient(90deg,#0FCED3,#5FE6E0); }
  .content { color: #DCE2F2; padding: 28px 28px 8px; font-size: 0.9rem; line-height: 1.7; }
  .content p { margin: 0 0 18px; }
  .content strong, .content b { color: #fff; }
  .content a { color: #5FE6E0; }
  .content ul, .content ol { margin: 0 0 18px; padding-left: 20px; }
  .content li { margin-bottom: 8px; }
  .foot { background: #0F1A2E; padding: 22px 28px; text-align: center; border-top: 1px solid #223252; }
  .foot p { font-size: 0.68rem; color: #5A6684; margin: 3px 0; line-height: 1.7; }
</style>
</head>
<body>
  <div class="email">
    <div class="head">
      <div class="logo">${escapeHtml(initialsFor(platformName))}</div>
      <div class="tag">${escapeHtml(platformName)}</div>
    </div>
    <div class="bar"></div>
    <div class="content">${bodyHtml}</div>
    <div class="foot">
      <p>${escapeHtml(platformName)}</p>
      <p>Has recibido este mensaje porque figuras como alumno/a en esta plataforma.</p>
    </div>
  </div>
</body>
</html>
`;
