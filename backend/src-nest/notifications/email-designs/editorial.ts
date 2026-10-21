import type { EmailDesignRenderer } from './types';
import { escapeHtml } from './helpers';

// Diseño E — "Editorial con franja": cabecera en degradado con el asunto
// del email como titular. En el boceto original la cabecera mostraba un
// "50%" grande porque la demo era de un aviso de progreso — aquí se
// generaliza a cualquier disparador usando el asunto ya resuelto, que
// siempre existe.
export const editorialDesign: EmailDesignRenderer = ({ platformName, subject, bodyHtml }) => `<!DOCTYPE html>
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
  .head { background: linear-gradient(135deg,#0B2545,#0FCED3); padding: 32px 28px 26px; text-align: center; }
  .tag { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: #BFEFF2; font-weight: 700; }
  .subject { font-size: 1.3rem; font-weight: 800; line-height: 1.25; margin-top: 10px; color: #fff; }
  .content { padding: 26px 28px 8px; color: #AEB4C4; font-size: 0.9rem; line-height: 1.7; }
  .content p { margin: 0 0 18px; }
  .content strong, .content b { color: #fff; }
  .content a { color: #5FE6E0; }
  .content ul, .content ol { margin: 0 0 18px; padding-left: 20px; }
  .content li { margin-bottom: 8px; }
  .foot { padding: 18px 28px; text-align: center; border-top: 1px solid #1C2944; }
  .foot p { font-size: 0.72rem; color: #5A6684; margin: 3px 0; }
</style>
</head>
<body>
  <div class="email">
    <div class="head">
      <div class="tag">${escapeHtml(platformName)}</div>
      <div class="subject">${escapeHtml(subject)}</div>
    </div>
    <div class="content">${bodyHtml}</div>
    <div class="foot">
      <p>${escapeHtml(platformName)}</p>
    </div>
  </div>
</body>
</html>
`;
