import type { EmailDesignRenderer } from './types';
import { initialsFor, escapeHtml } from './helpers';

// Diseño D — "Bloque de color": el único de los 4 que es claro por
// defecto, con el bloque de cabecera/pie en el color de acento cian de
// marca. Lleva su propio @media (prefers-color-scheme: dark) porque, a
// diferencia de A/B/E, su estado de reposo es claro — ver investigación de
// compatibilidad claro/oscuro compartida con el instructor.
export const colorBlockDesign: EmailDesignRenderer = ({ platformName, subject, bodyHtml }) => `<!DOCTYPE html>
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
  body { margin: 0; padding: 32px 16px; background: #F3F4F8; font-family: 'Poppins', Arial, sans-serif; }
  @media (prefers-color-scheme: dark) { body { background: #0A0A0D; } }
  .email { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 14px; overflow: hidden; }
  @media (prefers-color-scheme: dark) { .email { background: #11131A; } }
  .head { background: #0B93AA; padding: 34px 28px 28px; text-align: center; }
  .logo { width: 44px; height: 44px; border-radius: 50%; background: #FFFFFF; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #0B93AA; font-size: 0.92rem; }
  .tag { font-size: 0.74rem; color: #D9FBFF; font-weight: 600; letter-spacing: 0.04em; }
  .content { padding: 28px 28px 8px; color: #4A5064; font-size: 0.9rem; line-height: 1.7; }
  @media (prefers-color-scheme: dark) { .content { color: #AEB4C4; } }
  .content p { margin: 0 0 18px; }
  .content strong, .content b { color: #1B2333; }
  @media (prefers-color-scheme: dark) { .content strong, .content b { color: #F0F1F5; } }
  .content a { color: #0B93AA; }
  .content ul, .content ol { margin: 0 0 18px; padding-left: 20px; }
  .content li { margin-bottom: 8px; }
  .foot { background: #0B93AA; padding: 18px 28px; text-align: center; }
  .foot p { font-size: 0.72rem; color: #D9FBFF; margin: 3px 0; }
</style>
</head>
<body>
  <div class="email">
    <div class="head">
      <div class="logo">${escapeHtml(initialsFor(platformName))}</div>
      <div class="tag">${escapeHtml(platformName).toUpperCase()}</div>
    </div>
    <div class="content">${bodyHtml}</div>
    <div class="foot">
      <p>${escapeHtml(platformName)}</p>
    </div>
  </div>
</body>
</html>
`;
